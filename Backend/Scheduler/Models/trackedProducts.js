import supabase from "../../src/config/supabase.js";
import { extractExternalId } from "../../src/utils/normalize.js";
import logger from "../../src/utils/logger.js";

const DEFAULT_RETRY_DELAY_MINUTES = 15;
const DEFAULT_FREQUENCY_MINUTES = 120;

/**
 * List all active tracked products that are currently due for scraping.
 * A product is due if:
 * 1. force is true (forced execution).
 * 2. It has never been successfully scraped or failed (initial scrape).
 * 3. Its previous attempt failed and at least RETRY_DELAY_MINUTES (15 min) have elapsed.
 * 4. Its previous attempt succeeded and at least scrape_interval_minutes have elapsed.
 */
export async function listDue(options = {}) {
    const { force = false } = typeof options === "boolean" ? { force: options } : options;

    try {
        const { data: rows, error } = await supabase
            .from("tracked_products")
            .select(`
                id,
                product_id,
                is_active,
                scrape_interval_minutes,
                last_success_at,
                last_failure_at,
                last_scrape_status,
                created_at,
                updated_at,
                products (
                    id,
                    external_id,
                    name,
                    brand,
                    category,
                    sku,
                    product_url,
                    image_url
                )
            `)
            .eq("is_active", true);

        if (error) {
            logger.error("[trackedProducts.listDue] Query error:", error);
            throw error;
        }

        const now = Date.now();
        const due = [];

        for (const item of (rows || [])) {
            const frequencyMinutes = item.scrape_interval_minutes || DEFAULT_FREQUENCY_MINUTES;
            const product = item.products || {};
            
            // Extract external numeric ID needed by the store API
            let externalId = product.external_id ? parseInt(product.external_id, 10) : null;
            if (!externalId && product.product_url) {
                const extracted = extractExternalId(product.product_url);
                if (extracted) externalId = parseInt(extracted, 10);
            }

            let isDue = force;

            if (!isDue) {
                if (!item.last_success_at && !item.last_failure_at) {
                    // Never scraped before -> Immediately due
                    isDue = true;
                } else if (item.last_scrape_status === "failed" && item.last_failure_at) {
                    // Failed earlier -> retry after 15 minutes
                    const elapsedMs = now - new Date(item.last_failure_at).getTime();
                    if (elapsedMs >= DEFAULT_RETRY_DELAY_MINUTES * 60 * 1000) {
                        isDue = true;
                    }
                } else if (item.last_success_at) {
                    // Succeeded earlier -> retry after frequency interval
                    const elapsedMs = now - new Date(item.last_success_at).getTime();
                    if (elapsedMs >= frequencyMinutes * 60 * 1000) {
                        isDue = true;
                    }
                } else {
                    // Fallback: if last_scrape_status is unknown or pending
                    isDue = true;
                }
            }

            if (isDue) {
                due.push({
                    id: item.id,
                    product_id: item.product_id,
                    external_id: externalId,
                    scrape_frequency_minutes: frequencyMinutes,
                    scrape_interval_minutes: frequencyMinutes,
                    last_success_at: item.last_success_at,
                    last_failure_at: item.last_failure_at,
                    last_scrape_status: item.last_scrape_status,
                    product,
                });
            }
        }

        return due;
    } catch (err) {
        logger.error("[trackedProducts.listDue] Unexpected error:", err);
        throw err;
    }
}

/**
 * Mark a tracked product scrape attempt as successful.
 */
export async function markSuccess(trackedProductId, frequencyMinutes = DEFAULT_FREQUENCY_MINUTES) {
    try {
        const { data, error } = await supabase
            .from("tracked_products")
            .update({
                last_scrape_status: "success",
                last_success_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", trackedProductId)
            .select()
            .maybeSingle();

        if (error) {
            logger.error(`[trackedProducts.markSuccess] Failed for ID ${trackedProductId}:`, error);
            throw error;
        }

        return data;
    } catch (err) {
        logger.error(`[trackedProducts.markSuccess] Unexpected error for ID ${trackedProductId}:`, err);
        throw err;
    }
}

/**
 * Mark a tracked product scrape attempt as failed and schedule retry in retryDelayMinutes.
 */
export async function markFailure(trackedProductId, retryDelayMinutes = DEFAULT_RETRY_DELAY_MINUTES) {
    try {
        const { data, error } = await supabase
            .from("tracked_products")
            .update({
                last_scrape_status: "failed",
                last_failure_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", trackedProductId)
            .select()
            .maybeSingle();

        if (error) {
            logger.error(`[trackedProducts.markFailure] Failed for ID ${trackedProductId}:`, error);
            throw error;
        }

        return data;
    } catch (err) {
        logger.error(`[trackedProducts.markFailure] Unexpected error for ID ${trackedProductId}:`, err);
        throw err;
    }
}

/**
 * Fetch a single tracked product by ID.
 */
export async function getById(trackedProductId) {
    const { data, error } = await supabase
        .from("tracked_products")
        .select("*, products(*)")
        .eq("id", trackedProductId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export default {
    listDue,
    markSuccess,
    markFailure,
    getById,
};
