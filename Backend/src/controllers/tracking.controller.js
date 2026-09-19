import trackingService from "../services/tracking.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const trackingController = {
    /**
     * Start tracking a product (Section 13)
     * POST /api/tracked-products
     * Body: { productId: "uuid", scrapeIntervalMinutes: 120 }
     */
    async track(req, res, next) {
        try {
            const { productId, scrapeIntervalMinutes } = req.body;

            if (!productId) {
                return errorResponse(res, "VALIDATION_ERROR", "productId is required in request body", 400);
            }

            const trackedProduct = await trackingService.trackProduct(productId, scrapeIntervalMinutes);
            return successResponse(res, { trackedProduct }, 201);
        } catch (error) {
            next(error);
        }
    },

    /**
     * List all active tracked products with latest prices (Section 14)
     * GET /api/tracked-products
     */
    async list(req, res, next) {
        try {
            const trackedProducts = await trackingService.listTrackedProducts();
            return successResponse(res, { trackedProducts });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Untrack product (deactivates without deleting history) (Section 15)
     * DELETE /api/tracked-products/:id
     */
    async untrack(req, res, next) {
        try {
            const { id } = req.params;
            const deactivated = await trackingService.untrackProduct(id);
            return successResponse(res, { message: "Product untracked successfully", trackedProduct: deactivated });
        } catch (error) {
            next(error);
        }
    },
};

export default trackingController;
