import supabase from "../config/supabase.js";
import logger from "../utils/logger.js";

/**
 * Service for managing scrape_runs and scrape_attempts in Supabase
 */
export const logService = {
    /**
     * Creates a new scrape run
     */
    async createScrapeRun({ triggerType = "manual", totalProducts = 1 }) {
        const { data, error } = await supabase
            .from("scrape_runs")
            .insert({
                trigger_type: triggerType,
                status: "running",
                started_at: new Date().toISOString(),
                total_products: totalProducts,
                successful_products: 0,
                failed_products: 0,
                retried_products: 0,
            })
            .select()
            .single();

        if (error) {
            logger.error("Failed to create scrape_run:", error);
            // Return fallback mock ID if DB write fails so scraping can still proceed
            return { id: null };
        }

        return data;
    },

    /**
     * Updates an existing scrape run status
     */
    async updateScrapeRun(runId, updates) {
        if (!runId) return;

        const payload = {
            ...updates,
            finished_at: updates.finished_at || new Date().toISOString(),
        };

        const { error } = await supabase
            .from("scrape_runs")
            .update(payload)
            .eq("id", runId);

        if (error) {
            logger.error(`Failed to update scrape_run ${runId}:`, error);
        }
    },

    /**
     * Inserts a single scrape attempt log
     */
    async recordScrapeAttempt({
        scrapeRunId,
        trackedProductId,
        attemptNumber,
        status,
        startedAt,
        finishedAt,
        httpStatus = 200,
        responseTimeMs = 0,
        errorType = null,
        errorMessage = null,
    }) {
        const payload = {
            scrape_run_id: scrapeRunId || null,
            tracked_product_id: trackedProductId,
            attempt_number: attemptNumber,
            status,
            started_at: startedAt || new Date().toISOString(),
            finished_at: finishedAt || new Date().toISOString(),
            http_status: httpStatus,
            response_time_ms: responseTimeMs,
            error_type: errorType,
            error_message: errorMessage,
        };

        const { data, error } = await supabase
            .from("scrape_attempts")
            .insert(payload)
            .select()
            .single();

        if (error) {
            logger.error(`Failed to insert scrape_attempt for ${trackedProductId}:`, error);
            return null;
        }

        return data;
    },
};

export default logService;
