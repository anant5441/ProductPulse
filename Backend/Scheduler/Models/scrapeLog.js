import supabase from "../../src/config/supabase.js";
import logger from "../../src/utils/logger.js";

/**
 * Insert a scrape log attempt into scrape_attempts table.
 */
export async function insert(logData) {
    try {
        let trackedProductId = logData.tracked_product_id || logData.trackedProductId;

        // If only product_id was provided, resolve the tracked_product_id
        if (!trackedProductId && logData.product_id) {
            const { data: tracker } = await supabase
                .from("tracked_products")
                .select("id")
                .eq("product_id", logData.product_id)
                .maybeSingle();
            if (tracker) {
                trackedProductId = tracker.id;
            }
        }

        let scrapeRunId = logData.scrape_run_id || logData.scrapeRunId;

        // Ensure a scrape_run exists to satisfy potential foreign key relations
        if (!scrapeRunId) {
            try {
                const { data: run } = await supabase
                    .from("scrape_runs")
                    .insert({
                        trigger_type: "scheduled",
                        status: logData.status === "success" ? "completed" : "failed",
                        started_at: logData.attempted_at || new Date().toISOString(),
                        finished_at: new Date().toISOString(),
                        total_products: 1,
                        successful_products: logData.status === "success" ? 1 : 0,
                        failed_products: logData.status !== "success" ? 1 : 0,
                        retried_products: logData.retry_count || 0,
                        error_message: logData.error_message || null,
                    })
                    .select()
                    .maybeSingle();

                if (run) scrapeRunId = run.id;
            } catch (runErr) {
                logger.warn("[scrapeLog.insert] Could not create scrape_run:", runErr.message);
            }
        }

        const payload = {
            scrape_run_id: scrapeRunId || null,
            tracked_product_id: trackedProductId || null,
            attempt_number: (logData.retry_count || 0) + 1,
            status: logData.status || "success",
            started_at: logData.attempted_at || new Date().toISOString(),
            finished_at: new Date().toISOString(),
            http_status: logData.http_status || (logData.status === "success" ? 200 : 500),
            response_time_ms: logData.duration_ms || 0,
            error_type: logData.error_type || (logData.status === "structure_error" ? "PriceStructureError" : (logData.error_message ? "ScrapeError" : null)),
            error_message: logData.error_message || null,
        };

        const { data, error } = await supabase
            .from("scrape_attempts")
            .insert(payload)
            .select()
            .maybeSingle();

        if (error) {
            logger.error("[scrapeLog.insert] Failed to insert scrape_attempt:", error);
        }

        return data || payload;
    } catch (err) {
        logger.error("[scrapeLog.insert] Unexpected error:", err);
        return null;
    }
}

/**
 * List recent scrape attempts for a tracked product.
 */
export async function listLogs(trackedProductId, limit = 50) {
    const { data, error } = await supabase
        .from("scrape_attempts")
        .select("*")
        .eq("tracked_product_id", trackedProductId)
        .order("started_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

export default {
    insert,
    listLogs,
};
