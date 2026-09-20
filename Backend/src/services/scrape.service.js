import supabase from "../config/supabase.js";
import logService from "./log.service.js";
import alertService from "./alertService.js";
import { scrapeWithRetry } from "../scraper/retry.js";
import { extractExternalId } from "../utils/normalize.js";
import logger from "../utils/logger.js";
import ENV from "../config/env.js";

// In-memory mutex to prevent simultaneous scrapes for the same tracked product
const activeScrapes = new Set();

export const scrapeService = {
    /**
     * Manually trigger one product scrape (Section 16)
     */
    async scrapeTrackedProduct(trackedProductId, triggerType = "manual") {
        // 1. Check concurrency mutex
        if (activeScrapes.has(trackedProductId)) {
            const err = new Error("A scrape is already running for this product.");
            err.statusCode = 409;
            err.code = "SCRAPE_ALREADY_RUNNING";
            throw err;
        }

        activeScrapes.add(trackedProductId);

        try {
            // 2. Fetch tracked product and product details
            const { data: tracker, error: trackErr } = await supabase
                .from("tracked_products")
                .select("*, products(*)")
                .eq("id", trackedProductId)
                .maybeSingle();

            if (trackErr || !tracker) {
                const err = new Error(`Tracked product not found with ID: ${trackedProductId}`);
                err.statusCode = 404;
                err.code = "TRACKED_PRODUCT_NOT_FOUND";
                throw err;
            }

            if (!tracker.is_active) {
                const err = new Error("Cannot scrape an inactive tracked product.");
                err.statusCode = 400;
                err.code = "TRACKED_PRODUCT_INACTIVE";
                throw err;
            }

            const externalId = tracker.products?.external_id || extractExternalId(tracker.products?.product_url);
            if (!externalId) {
                throw new Error("Product is missing external_id or product_url");
            }

            // 3. Create scrape run record
            const scrapeRun = await logService.createScrapeRun({
                triggerType,
                totalProducts: 1,
            });

            // 4. Update status to 'running'
            await supabase
                .from("tracked_products")
                .update({
                    last_scrape_status: "running",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", trackedProductId);

            // 5. Execute scraper with retry
            const scrapeOutcome = await scrapeWithRetry(externalId, trackedProductId, ENV.SCRAPER_MAX_ATTEMPTS);

            // 6. Record all attempts into scrape_attempts table
            const loggedAttempts = [];
            for (const att of scrapeOutcome.attempts) {
                const logged = await logService.recordScrapeAttempt({
                    scrapeRunId: scrapeRun.id,
                    trackedProductId,
                    attemptNumber: att.attempt_number,
                    status: att.status,
                    startedAt: att.started_at,
                    finishedAt: att.finished_at,
                    httpStatus: att.http_status,
                    responseTimeMs: att.response_time_ms,
                    errorType: att.error_type,
                    errorMessage: att.error_message,
                });
                if (logged) loggedAttempts.push(logged);
            }

            // 7. Handle Success or Failure
            if (scrapeOutcome.success && scrapeOutcome.product) {
                const product = scrapeOutcome.product;
                const successfulAttempt = loggedAttempts.find((a) => a.status === "success") || loggedAttempts[loggedAttempts.length - 1];

                // Fetch previous successful observation for alert evaluation (Section 5 & 6)
                const { data: previousObservation } = await supabase
                    .from("price_history")
                    .select("price, original_price, discount_percentage, stock, stock_status, scraped_at")
                    .eq("tracked_product_id", trackedProductId)
                    .order("scraped_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Insert ONE validated row into price_history
                const { error: priceErr } = await supabase.from("price_history").insert({
                    tracked_product_id: trackedProductId,
                    scrape_attempt_id: successfulAttempt?.id || null,
                    price: product.currentPrice,
                    original_price: product.originalPrice,
                    discount_percentage: product.discount,
                    stock: product.stockQuantity,
                    stock_status: product.stockStatus,
                    delivery_text: product.delivery,
                    delivery_date: product.deliveryDate,
                    seller_name: product.seller,
                    rating: product.rating,
                    rating_count: product.ratingCount,
                    scraped_at: product.scrapedAt || new Date().toISOString(),
                    raw_data: product.raw_data || {},
                });

                if (priceErr) {
                    logger.error("Failed to insert price_history:", priceErr);
                }

                // Evaluate price-drop & back-in-stock alerts (Section 10 & 31: non-blocking)
                try {
                    await alertService.evaluateAlerts({
                        trackedProduct: tracker,
                        previousObservation,
                        currentObservation: {
                            price: product.currentPrice,
                            stock_status: product.stockStatus,
                            stock: product.stockQuantity,
                            scraped_at: product.scrapedAt || new Date().toISOString(),
                        },
                    });
                } catch (alertErr) {
                    logger.error("Alert evaluation encountered an error (scrape preserved):", alertErr);
                }

                // Update tracked product status to success
                await supabase
                    .from("tracked_products")
                    .update({
                        last_scrape_status: "success",
                        last_success_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", trackedProductId);

                // Finish scrape run
                await logService.updateScrapeRun(scrapeRun.id, {
                    status: "completed",
                    successful_products: 1,
                    failed_products: 0,
                    retried_products: scrapeOutcome.attempts.length > 1 ? 1 : 0,
                });

                return {
                    success: true,
                    data: {
                        status: "success",
                        attempts: scrapeOutcome.attempts.length,
                        price: product.currentPrice,
                        stockStatus: product.stockStatus,
                        stockQuantity: product.stockQuantity,
                    },
                };
            } else {
                // FAILURE: Update tracked product failure state
                await supabase
                    .from("tracked_products")
                    .update({
                        last_scrape_status: "failed",
                        last_failure_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", trackedProductId);

                // Finish scrape run as failed
                await logService.updateScrapeRun(scrapeRun.id, {
                    status: "failed",
                    successful_products: 0,
                    failed_products: 1,
                    retried_products: scrapeOutcome.attempts.length > 1 ? 1 : 0,
                    error_message: scrapeOutcome.lastError?.message || "Scraping failed after retries",
                });

                return {
                    success: false,
                    error: {
                        code: "SCRAPE_FAILED",
                        message: `Scrape failed after ${scrapeOutcome.attempts.length} attempts: ${scrapeOutcome.lastError?.message || "Unknown error"}`,
                    },
                    data: {
                        attempts: scrapeOutcome.attempts.length,
                    },
                };
            }
        } finally {
            activeScrapes.delete(trackedProductId);
        }
    },

    /**
     * External Cron Scrape runner (Sections 26, 27, 28)
     */
    async runCronScrape() {
        // 1. Fetch all active tracked products
        const { data: trackers, error } = await supabase
            .from("tracked_products")
            .select("*, products(*)")
            .eq("is_active", true);

        if (error || !Array.isArray(trackers)) {
            throw new Error(`Failed to fetch active tracked products: ${error?.message}`);
        }

        // 2. Filter for products due for scraping
        const now = Date.now();
        const dueTrackers = trackers.filter((t) => {
            if (!t.last_success_at) return true;
            const intervalMs = (t.scrape_interval_minutes || 120) * 60 * 1000;
            const nextDueTime = new Date(t.last_success_at).getTime() + intervalMs;
            return now >= nextDueTime;
        });

        logger.info(`Cron Scrape: ${dueTrackers.length} of ${trackers.length} products due for scraping.`);

        if (dueTrackers.length === 0) {
            return {
                totalDue: 0,
                scraped: 0,
                successful: 0,
                failed: 0,
            };
        }

        // 3. Create a master scrape run for this cron cycle
        const masterRun = await logService.createScrapeRun({
            triggerType: "cron",
            totalProducts: dueTrackers.length,
        });

        let successfulCount = 0;
        let failedCount = 0;

        // 4. Controlled concurrency execution (e.g. 2 concurrent scrapes)
        const concurrency = ENV.MAX_CONCURRENT_SCRAPES || 2;
        for (let i = 0; i < dueTrackers.length; i += concurrency) {
            const batch = dueTrackers.slice(i, i + concurrency);
            await Promise.all(
                batch.map(async (tracker) => {
                    try {
                        const result = await this.scrapeTrackedProduct(tracker.id, "cron");
                        if (result.success) {
                            successfulCount++;
                        } else {
                            failedCount++;
                        }
                    } catch (err) {
                        failedCount++;
                        logger.error(`Cron scrape failed for tracked product ${tracker.id}:`, err);
                    }
                })
            );
        }

        // 5. Update master scrape run
        await logService.updateScrapeRun(masterRun.id, {
            status: failedCount === dueTrackers.length ? "failed" : "completed",
            successful_products: successfulCount,
            failed_products: failedCount,
        });

        return {
            totalDue: dueTrackers.length,
            scraped: successfulCount + failedCount,
            successful: successfulCount,
            failed: failedCount,
        };
    },
};

export default scrapeService;
