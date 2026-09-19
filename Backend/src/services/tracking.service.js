import supabase from "../config/supabase.js";
import productService from "./product.service.js";
import logger from "../utils/logger.js";

export const trackingService = {
    /**
     * Start tracking a product (Sections 13 & 41: Duplicate Protection)
     */
    async trackProduct(productId, scrapeIntervalMinutes = 120) {
        // 1. Verify product exists
        const { data: product, error: productErr } = await supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .maybeSingle();

        if (productErr || !product) {
            throw new Error(`Product not found with ID: ${productId}`);
        }

        // 2. Check if tracker already exists for this product
        const { data: existingTrackers, error: trackErr } = await supabase
            .from("tracked_products")
            .select("*")
            .eq("product_id", productId);

        if (!trackErr && Array.isArray(existingTrackers) && existingTrackers.length > 0) {
            const active = existingTrackers.find((t) => t.is_active);
            if (active) {
                // Return existing active tracker without creating duplicate
                return active;
            }

            // Reactivate inactive tracker
            const inactive = existingTrackers[0];
            const { data: reactivated } = await supabase
                .from("tracked_products")
                .update({
                    is_active: true,
                    scrape_interval_minutes: scrapeIntervalMinutes || inactive.scrape_interval_minutes || 120,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", inactive.id)
                .select()
                .single();

            return reactivated || inactive;
        }

        // 3. Create new tracked_product row
        const { data: newTracker, error: createErr } = await supabase
            .from("tracked_products")
            .insert({
                product_id: productId,
                is_active: true,
                scrape_interval_minutes: scrapeIntervalMinutes || 120,
                last_scrape_status: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (createErr) {
            logger.error("Failed to create tracked_product:", createErr);
            throw new Error(`Could not track product: ${createErr.message}`);
        }

        return newTracker;
    },

    /**
     * List all active tracked products joined with products & latest prices (Section 14)
     */
    async listTrackedProducts() {
        const { data: trackers, error } = await supabase
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
                    image_url,
                    description
                )
            `)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) {
            logger.error("Failed to fetch tracked products:", error);
            throw new Error(error.message);
        }

        // Fetch latest price for each tracked product
        const trackedProducts = await Promise.all(
            (trackers || []).map(async (t) => {
                const { data: latestPrice } = await supabase
                    .from("price_history")
                    .select("price, original_price, discount_percentage, stock, stock_status, scraped_at")
                    .eq("tracked_product_id", t.id)
                    .order("scraped_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                return {
                    trackingId: t.id,
                    product: t.products,
                    isActive: t.is_active,
                    scrapeIntervalMinutes: t.scrape_interval_minutes,
                    lastSuccessAt: t.last_success_at,
                    lastFailureAt: t.last_failure_at,
                    lastScrapeStatus: t.last_scrape_status,
                    latestPrice: latestPrice ? Number(latestPrice.price) : null,
                    originalPrice: latestPrice ? Number(latestPrice.original_price) : null,
                    discount: latestPrice ? Number(latestPrice.discount_percentage) : null,
                    stockStatus: latestPrice ? latestPrice.stock_status : null,
                    stockQuantity: latestPrice ? latestPrice.stock : null,
                    lastScrapedAt: latestPrice ? latestPrice.scraped_at : null,
                };
            })
        );

        return trackedProducts;
    },

    /**
     * Untrack product (Section 15 & 42: Preserve history, set is_active = false)
     */
    async untrackProduct(trackedProductId) {
        const { data, error } = await supabase
            .from("tracked_products")
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            .eq("id", trackedProductId)
            .select()
            .single();

        if (error) {
            logger.error(`Failed to untrack product ${trackedProductId}:`, error);
            throw new Error(error.message);
        }

        return data;
    },
};

export default trackingService;
