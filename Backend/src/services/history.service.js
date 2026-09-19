import supabase from "../config/supabase.js";
import logger from "../utils/logger.js";

export const historyService = {
    /**
     * Get detailed price history for a tracked product (Section 21)
     */
    async getProductHistory(trackedProductId, { from, to, limit = 100, offset = 0 } = {}) {
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

        let query = supabase
            .from("price_history")
            .select("*")
            .eq("tracked_product_id", trackedProductId)
            .order("scraped_at", { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (from) {
            query = query.gte("scraped_at", from);
        }
        if (to) {
            query = query.lte("scraped_at", to);
        }

        const { data, error } = await query;

        if (error) {
            logger.error("Failed to query price history:", error);
            throw new Error(error.message);
        }

        const history = (data || []).map((row) => ({
            id: row.id,
            price: Number(row.price),
            originalPrice: row.original_price ? Number(row.original_price) : null,
            discount: row.discount_percentage ? Number(row.discount_percentage) : null,
            stock: row.stock !== null ? Number(row.stock) : null,
            stockStatus: row.stock_status,
            deliveryText: row.delivery_text,
            deliveryDate: row.delivery_date,
            sellerName: row.seller_name,
            rating: row.rating ? Number(row.rating) : null,
            ratingCount: row.rating_count ? Number(row.rating_count) : null,
            scrapedAt: row.scraped_at,
        }));

        return history;
    },

    /**
     * Lightweight chart-friendly price history (Section 22)
     */
    async getPriceChart(trackedProductId) {
        const { data, error } = await supabase
            .from("price_history")
            .select("scraped_at, price")
            .eq("tracked_product_id", trackedProductId)
            .order("scraped_at", { ascending: true });

        if (error) {
            logger.error("Failed to query price chart:", error);
            throw new Error(error.message);
        }

        return (data || []).map((row) => ({
            timestamp: row.scraped_at,
            price: Number(row.price),
        }));
    },

    /**
     * Lightweight stock history (Section 23)
     */
    async getStockHistory(trackedProductId) {
        const { data, error } = await supabase
            .from("price_history")
            .select("scraped_at, stock, stock_status")
            .eq("tracked_product_id", trackedProductId)
            .order("scraped_at", { ascending: true });

        if (error) {
            logger.error("Failed to query stock history:", error);
            throw new Error(error.message);
        }

        return (data || []).map((row) => ({
            timestamp: row.scraped_at,
            stock: row.stock !== null ? Number(row.stock) : null,
            status: row.stock_status,
        }));
    },

    /**
     * Get all scrape attempts for a tracked product (Section 24)
     */
    async getScrapeLogs(trackedProductId) {
        const { data, error } = await supabase
            .from("scrape_attempts")
            .select("*")
            .eq("tracked_product_id", trackedProductId)
            .order("started_at", { ascending: false })
            .limit(100);

        if (error) {
            logger.error("Failed to query scrape logs:", error);
            throw new Error(error.message);
        }

        return (data || []).map((row) => ({
            id: row.id,
            attemptNumber: row.attempt_number,
            status: row.status,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            httpStatus: row.http_status,
            responseTimeMs: row.response_time_ms,
            errorType: row.error_type,
            errorMessage: row.error_message,
        }));
    },

    /**
     * Get latest status summary (Section 25)
     */
    async getTrackedStatus(trackedProductId) {
        const { data: tracker, error: trackErr } = await supabase
            .from("tracked_products")
            .select("*")
            .eq("id", trackedProductId)
            .maybeSingle();

        if (trackErr || !tracker) {
            throw new Error(`Tracked product not found: ${trackedProductId}`);
        }

        const { data: latestPrice } = await supabase
            .from("price_history")
            .select("price, stock_status")
            .eq("tracked_product_id", trackedProductId)
            .order("scraped_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        return {
            status: tracker.last_scrape_status,
            lastSuccessAt: tracker.last_success_at,
            lastFailureAt: tracker.last_failure_at,
            latestPrice: latestPrice ? Number(latestPrice.price) : null,
            stockStatus: latestPrice ? latestPrice.stock_status : null,
        };
    },
};

export default historyService;
