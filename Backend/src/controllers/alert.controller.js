import alertService from "../services/alertService.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const alertController = {
    /**
     * Get alert preferences for a tracked product
     * GET /api/tracked-products/:trackingId/alerts
     */
    async getPreferences(req, res, next) {
        try {
            const trackingId = req.params.trackingId || req.params.id;
            if (!trackingId) {
                return errorResponse(res, "VALIDATION_ERROR", "trackingId is required", 400);
            }

            const preferences = await alertService.getPreferences(trackingId);
            return successResponse(res, { preferences });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update alert preferences for a tracked product
     * PUT /api/tracked-products/:trackingId/alerts
     */
    async updatePreferences(req, res, next) {
        try {
            const trackingId = req.params.trackingId || req.params.id;
            const {
                priceDropEnabled,
                priceDropThreshold,
                backInStockEnabled,
                inAppEnabled,
                emailEnabled,
                emailAddress,
                cooldownMinutes,
            } = req.body;

            if (!trackingId) {
                return errorResponse(res, "VALIDATION_ERROR", "trackingId is required", 400);
            }

            const preferences = await alertService.upsertPreferences(trackingId, {
                priceDropEnabled,
                priceDropThreshold,
                backInStockEnabled,
                inAppEnabled,
                emailEnabled,
                emailAddress,
                cooldownMinutes,
            });

            return successResponse(res, { preferences });
        } catch (error) {
            if (error.statusCode === 400) {
                return errorResponse(res, "VALIDATION_ERROR", error.message, 400);
            }
            next(error);
        }
    },
};

export default alertController;
