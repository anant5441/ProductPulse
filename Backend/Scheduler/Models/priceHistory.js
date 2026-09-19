import supabase from "../../src/config/supabase.js";
import logger from "../../src/utils/logger.js";

/**
 * Insert a verified price record into price_history.
 */
export async function insert(mappedData) {
    try {
        const payload = {
            tracked_product_id: mappedData.tracked_product_id || mappedData.trackedProductId,
            scrape_attempt_id: mappedData.scrape_attempt_id || mappedData.scrapeAttemptId || null,
            price: Number(mappedData.price),
            original_price: mappedData.original_price != null ? Number(mappedData.original_price) : (mappedData.mrp != null ? Number(mappedData.mrp) : null),
            discount_percentage: mappedData.discount_percentage != null ? Number(mappedData.discount_percentage) : (mappedData.badge_pct != null ? Number(mappedData.badge_pct) : null),
            stock: mappedData.stock != null ? Number(mappedData.stock) : null,
            currency: mappedData.currency || "INR",
            stock_status: mappedData.stock_status || (mappedData.stock > 0 ? (mappedData.stock <= 5 ? "low_stock" : "in_stock") : (mappedData.stock === 0 ? "out_of_stock" : "unknown")),
            delivery_text: mappedData.delivery_text || (mappedData.delivery_days ? `${mappedData.delivery_days} days` : null),
            delivery_date: mappedData.delivery_date || null,
            seller_name: mappedData.seller_name || mappedData.seller || null,
            rating: mappedData.rating != null ? Number(mappedData.rating) : null,
            rating_count: mappedData.rating_count != null ? Number(mappedData.rating_count) : null,
            raw_data: mappedData.raw_data || {
                variant: mappedData.variant,
                format: mappedData.format,
                pending: mappedData.pending,
                triple: mappedData.triple,
                sale: mappedData.sale,
            },
            scraped_at: mappedData.scraped_at || new Date().toISOString(),
        };

        if (isNaN(payload.price) || payload.price <= 0) {
            throw new Error(`Invalid price value for history insertion: ${mappedData.price}`);
        }

        const { data, error } = await supabase
            .from("price_history")
            .insert(payload)
            .select()
            .single();

        if (error) {
            logger.error("[priceHistory.insert] Supabase insert error:", error);
            throw error;
        }

        return data;
    } catch (err) {
        logger.error("[priceHistory.insert] Unexpected error:", err);
        throw err;
    }
}

/**
 * Fetch the latest price record for a tracked product or product ID.
 */
export async function latest(trackedProductIdOrProductId) {
    try {
        if (!trackedProductIdOrProductId) return null;

        // Try querying directly by tracked_product_id
        let { data, error } = await supabase
            .from("price_history")
            .select("*")
            .eq("tracked_product_id", trackedProductIdOrProductId)
            .order("scraped_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        // If not found, check if trackedProductIdOrProductId is product_id
        if (!data) {
            const { data: tracker } = await supabase
                .from("tracked_products")
                .select("id")
                .eq("product_id", trackedProductIdOrProductId)
                .maybeSingle();

            if (tracker) {
                const res = await supabase
                    .from("price_history")
                    .select("*")
                    .eq("tracked_product_id", tracker.id)
                    .order("scraped_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                data = res.data;
            }
        }

        return data || null;
    } catch (err) {
        logger.error("[priceHistory.latest] Unexpected error:", err);
        return null;
    }
}

/**
 * List price history for a given tracked product.
 */
export async function listHistory(trackedProductId, limit = 50) {
    const { data, error } = await supabase
        .from("price_history")
        .select("*")
        .eq("tracked_product_id", trackedProductId)
        .order("scraped_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

export default {
    insert,
    latest,
    listHistory,
};
