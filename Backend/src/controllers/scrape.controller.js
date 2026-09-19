import scrapeService from "../services/scrape.service.js";
import { runDueScrapes } from "../../Scheduler/index.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const scrapeController = {
    /**
     * Manually trigger one product scrape (Section 16 & 45)
     * POST /api/scrape/product/:trackedProductId
     */
    async scrapeProduct(req, res, next) {
        try {
            const { trackedProductId } = req.params;
            const result = await scrapeService.scrapeTrackedProduct(trackedProductId, "manual");

            if (result.success) {
                return successResponse(res, result.data, 200);
            } else {
                return res.status(502).json({
                    success: false,
                    error: result.error,
                    data: result.data,
                });
            }
        } catch (error) {
            if (error.statusCode === 409) {
                return errorResponse(res, "SCRAPE_ALREADY_RUNNING", error.message, 409);
            }
            if (error.statusCode === 404) {
                return errorResponse(res, "TRACKED_PRODUCT_NOT_FOUND", error.message, 404);
            }
            if (error.statusCode === 400) {
                return errorResponse(res, "BAD_REQUEST", error.message, 400);
            }
            next(error);
        }
    },

    /**
     * External Cron trigger endpoint (Section 26 & 27)
     * POST /api/cron/scrape
     */
    async runCron(req, res, next) {
        try {
            const result = await scrapeService.runCronScrape();
            return successResponse(res, {
                message: "Cron scrape cycle completed",
                ...result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Direct Scheduler Run-Due endpoint
     * GET or POST /api/scheduler/run-due
     */
    async runScheduler(req, res, next) {
        try {
            const isForce = req.query.force === "true" || req.query.force === "1" || req.body?.force === true;
            const summary = await runDueScrapes({ force: isForce });
            return successResponse(res, {
                message: "Scheduler run-due cycle completed",
                summary,
            });
        } catch (error) {
            next(error);
        }
    },
};

export default scrapeController;
