import { scrapeProductData } from "./scraper.js";
import { validateScrapedProduct } from "./validator.js";
import logger from "../utils/logger.js";
import ENV from "../config/env.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Classifies an error into standard error_type values (Section 33)
 */
export function classifyError(error) {
    const msg = (error?.message || "").toLowerCase();
    
    if (msg.includes("timeout") || msg.includes("timed out") || error?.name === "TimeoutError") {
        if (msg.includes("price") || msg.includes("reveal")) return "REVEAL_PRICE_TIMEOUT";
        return "NAVIGATION_TIMEOUT";
    }
    if (msg.includes("challenge") || msg.includes("wasm") || msg.includes("proof of work")) {
        return "CHALLENGE_ERROR";
    }
    if (msg.includes("price is missing") || msg.includes("invalid or missing current price")) {
        return "PRICE_NOT_FOUND";
    }
    if (msg.includes("stock") || msg.includes("stock status")) {
        return "STOCK_NOT_FOUND";
    }
    if (msg.includes("validation")) {
        return "VALIDATION_ERROR";
    }
    if (msg.includes("http") || msg.includes("status 4") || msg.includes("status 5")) {
        return "HTTP_ERROR";
    }
    if (msg.includes("browser") || msg.includes("playwright") || msg.includes("context")) {
        return "BROWSER_ERROR";
    }
    return "UNKNOWN_ERROR";
}

/**
 * Executes a scrape with retry and records every individual attempt.
 *
 * @param {string} externalId Product external ID (e.g. "291")
 * @param {string} trackedProductId UUID of the tracked product (for logging)
 * @param {number} maxAttempts Maximum retry attempts
 * @returns {Promise<{ success: boolean, attempts: Array, product: object|null, lastError: object|null }>}
 */
export async function scrapeWithRetry(externalId, trackedProductId, maxAttempts = ENV.SCRAPER_MAX_ATTEMPTS) {
    const attempts = [];
    let successfulProduct = null;
    let lastError = null;

    logger.scrapeStart(trackedProductId, { externalId, maxAttempts });

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
        const startedAt = new Date().toISOString();
        const startClock = performance.now();
        logger.scrapeAttempt(trackedProductId, attemptNumber);

        try {
            const product = await scrapeProductData(externalId);
            const validation = validateScrapedProduct(product);

            const finishedAt = new Date().toISOString();
            const responseTimeMs = Math.round(performance.now() - startClock);

            if (!validation.isValid) {
                const validationError = new Error(`Validation failed: ${validation.errors.join(", ")}`);
                const errorType = "VALIDATION_ERROR";

                attempts.push({
                    attempt_number: attemptNumber,
                    status: "validation_failed",
                    started_at: startedAt,
                    finished_at: finishedAt,
                    http_status: 200,
                    response_time_ms: responseTimeMs,
                    error_type: errorType,
                    error_message: validationError.message,
                });

                lastError = validationError;
                logger.scrapeFailure(trackedProductId, validationError.message, { attemptNumber, errorType });
            } else {
                // SUCCESS
                attempts.push({
                    attempt_number: attemptNumber,
                    status: "success",
                    started_at: startedAt,
                    finished_at: finishedAt,
                    http_status: 200,
                    response_time_ms: responseTimeMs,
                    error_type: null,
                    error_message: null,
                });

                successfulProduct = product;
                logger.scrapeSuccess(trackedProductId, product.currentPrice, { attemptNumber, responseTimeMs });
                return {
                    success: true,
                    attempts,
                    product: successfulProduct,
                    lastError: null,
                };
            }
        } catch (error) {
            const finishedAt = new Date().toISOString();
            const responseTimeMs = Math.round(performance.now() - startClock);
            const errorType = classifyError(error);

            attempts.push({
                attempt_number: attemptNumber,
                status: errorType.includes("TIMEOUT") ? "timeout" : "failed",
                started_at: startedAt,
                finished_at: finishedAt,
                http_status: error?.status || 500,
                response_time_ms: responseTimeMs,
                error_type: errorType,
                error_message: error.message,
            });

            lastError = error;
            logger.scrapeFailure(trackedProductId, error.message, { attemptNumber, errorType });
        }

        // Exponential backoff if not the final attempt
        if (attemptNumber < maxAttempts) {
            const delay = 2000 * Math.pow(2, attemptNumber - 1);
            await sleep(delay);
        }
    }

    return {
        success: false,
        attempts,
        product: null,
        lastError,
    };
}
