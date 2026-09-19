import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { fetchPrice, PriceStructureError, PriceChallengeError } from "../Scraper/price.js";
import { listDue, markFailure, markSuccess } from "./Models/trackedProducts.js";
import { insert as insertPriceHistory, latest as latestPrice } from "./Models/priceHistory.js";
import { insert as insertScrapeLog } from "./Models/scrapeLog.js";
import { listActive, markTriggered } from "./Models/alerts.js";
import logger from "../src/utils/logger.js";

// Configurable constants
export const RETRY_DELAY_MINUTES = 15;
export const DEFAULT_SCRAPE_FREQUENCY_MINUTES = 120;

/**
 * Normalizes raw quote data from the scraper into the database price_history format.
 */
export function mapQuote(tracked, quote) {
    const productId = tracked.product_id || tracked.productId || tracked;
    const trackedProductId = tracked.id || tracked.trackedProductId || null;

    return {
        product_id: productId,
        tracked_product_id: trackedProductId,
        price: quote.price,
        mrp: quote.mrp,
        sale: quote.sale,
        badge_pct: quote.badgePct,
        stock: quote.stock,
        currency: quote.currency || "INR",
        rating: quote.rating,
        rating_count: quote.ratingCount,
        seller: quote.seller,
        delivery_days: quote.deliveryDays,
        variant: quote.variant,
        format: quote.format,
        pending: quote.pending,
        triple: quote.triple,
        quoted_at: quote.at ? new Date(quote.at).toISOString() : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
    };
}

/**
 * Evaluates active alerts against the newly scraped quote and previous price record.
 */
export async function evaluateAlerts(productId, prev, quote) {
    const alerts = await listActive(productId);
    let fired = 0;

    for (const alert of alerts) {
        let fire = false;

        if (alert.type === "price_drop") {
            fire = Boolean(prev) && quote.price < Number(prev.price);
        } else if (alert.type === "back_in_stock") {
            fire = Boolean(prev) && (prev.stock == null || Number(prev.stock) === 0) && Number(quote.stock) > 0;
        } else if (alert.type === "target_price" && alert.target_price) {
            fire = quote.price <= Number(alert.target_price);
        }

        if (fire) {
            await markTriggered(alert.id);
            fired++;
            logger.info(`[Scheduler] Alert fired: ${alert.type} (ID: ${alert.id}) for product ${productId}`);
        }
    }

    return fired;
}

/**
 * Main Scheduler Engine: Finds all overdue tracked products, fetches prices,
 * updates history, logs scrape runs, evaluates alerts, and reschedules.
 */
export async function runDueScrapes(options = {}) {
    const { force = false } = typeof options === "boolean" ? { force: options } : options;
    const startTime = performance.now();
    const due = await listDue({ force });

    const summary = {
        claimed: due.length,
        succeeded: 0,
        failed: 0,
        structureError: 0,
        alertsFired: 0,
        durationMs: 0,
        details: [],
    };

    if (due.length === 0) {
        logger.info(`[Scheduler] No tracked products are currently due for scraping.`);
        summary.durationMs = Math.round(performance.now() - startTime);
        return summary;
    }

    logger.info(`[Scheduler] Claimed ${due.length} tracked product(s) due for scraping.`);

    for (const tracked of due) {
        const started = performance.now();
        const externalId = tracked.external_id || (tracked.product?.external_id ? parseInt(tracked.product.external_id, 10) : null);

        if (!externalId) {
            const errDurationMs = Math.round(performance.now() - started);
            const errMsg = `Missing external product ID for tracked product ${tracked.id}`;
            logger.warn(`[Scheduler] ${errMsg}`);

            await insertScrapeLog({
                tracked_product_id: tracked.id,
                product_id: tracked.product_id,
                attempted_at: new Date().toISOString(),
                status: "failed",
                retry_count: 0,
                error_message: errMsg,
                duration_ms: errDurationMs,
            });
            await markFailure(tracked.id, RETRY_DELAY_MINUTES);

            summary.failed++;
            summary.details.push({
                trackedId: tracked.id,
                productId: tracked.product_id,
                status: "failed",
                error: errMsg,
            });
            continue;
        }

        try {
            // 1. Fetch previous price observation for alert evaluation
            const prev = await latestPrice(tracked.id || tracked.product_id);

            // 2. Fetch fresh quote from store using cryptographic handshake scraper
            const quote = await fetchPrice(externalId);
            const durationMs = Math.round(performance.now() - started);

            // 3. Persist verified price history row
            const mapped = mapQuote(tracked, quote);
            const priceRow = await insertPriceHistory(mapped);

            // 4. Record successful scrape log
            await insertScrapeLog({
                tracked_product_id: tracked.id,
                product_id: tracked.product_id,
                attempted_at: new Date().toISOString(),
                status: "success",
                retry_count: 0,
                duration_ms: durationMs,
                price_history_id: priceRow?.id || null,
            });

            // 5. Evaluate triggered alerts
            const fired = await evaluateAlerts(tracked.product_id, prev, quote);

            // 6. Mark tracked product success with configured frequency
            await markSuccess(tracked.id, tracked.scrape_frequency_minutes || DEFAULT_SCRAPE_FREQUENCY_MINUTES);

            summary.succeeded++;
            summary.alertsFired += fired;
            summary.details.push({
                trackedId: tracked.id,
                productId: tracked.product_id,
                externalId,
                status: "success",
                price: quote.price,
                stock: quote.stock,
                alertsFired: fired,
                durationMs,
            });

            logger.info(`[Scheduler] Success: Product ${externalId} (Tracked: ${tracked.id}) @ ₹${quote.price} (${durationMs}ms)`);
        } catch (error) {
            const durationMs = Math.round(performance.now() - started);
            const isStructureError = error instanceof PriceStructureError;
            const status = isStructureError ? "structure_error" : "failed";

            logger.error(`[Scheduler] Scrape ${status} for product ${externalId} (Tracked: ${tracked.id}): ${error.message}`);

            // Insert failure log
            await insertScrapeLog({
                tracked_product_id: tracked.id,
                product_id: tracked.product_id,
                attempted_at: new Date().toISOString(),
                status,
                retry_count: 0,
                error_type: error.name || (isStructureError ? "PriceStructureError" : "ScrapeError"),
                error_message: error.message,
                duration_ms: durationMs,
            });

            // Mark failure and schedule 15-minute retry
            await markFailure(tracked.id, RETRY_DELAY_MINUTES);

            if (isStructureError) {
                summary.structureError++;
            } else {
                summary.failed++;
            }

            summary.details.push({
                trackedId: tracked.id,
                productId: tracked.product_id,
                externalId,
                status,
                error: error.message,
                durationMs,
            });
        }
    }

    summary.durationMs = Math.round(performance.now() - startTime);
    logger.info(`[Scheduler] Cycle completed in ${summary.durationMs}ms: ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.structureError} structure errors.`);

    return summary;
}

// Standalone CLI runner support
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const isForce = process.argv.includes("--force") || process.argv.includes("-f");

    console.log("==========================================");
    console.log("     ProductPulse Scheduler Runner        ");
    if (isForce) console.log("     (Mode: FORCE ALL ACTIVE)         ");
    console.log("==========================================");

    runDueScrapes({ force: isForce })
        .then((summary) => {
            console.log("\nExecution Summary:");
            console.log(JSON.stringify(summary, null, 2));

            if (summary.claimed === 0) {
                console.log("\n💡 Tip: No active products were due. To track products, use the API/dashboard or pass '--force' to scrape all active trackers immediately.");
            }
            process.exit(summary.failed > 0 && summary.succeeded === 0 ? 1 : 0);
        })
        .catch((err) => {
            console.error("\n[Fatal] Scheduler execution failed:", err);
            process.exit(1);
        });
}

export default runDueScrapes;
