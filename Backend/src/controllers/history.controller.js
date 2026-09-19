import historyService from "../services/history.service.js";
import { successResponse } from "../utils/response.js";

export const historyController = {
    /**
     * Detailed price history (Section 21)
     * GET /api/tracked-products/:id/history
     */
    async getHistory(req, res, next) {
        try {
            const { id } = req.params;
            const { from, to, limit, offset } = req.query;
            const history = await historyService.getProductHistory(id, { from, to, limit, offset });
            return successResponse(res, { history });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Chart-friendly price history (Section 22)
     * GET /api/tracked-products/:id/price-history
     */
    async getPriceHistory(req, res, next) {
        try {
            const { id } = req.params;
            const priceHistory = await historyService.getPriceChart(id);
            // Returns chart-friendly array format directly as specified in Section 22
            return res.status(200).json(priceHistory);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Stock history (Section 23)
     * GET /api/tracked-products/:id/stock-history
     */
    async getStockHistory(req, res, next) {
        try {
            const { id } = req.params;
            const stockHistory = await historyService.getStockHistory(id);
            // Returns stock array format directly as specified in Section 23
            return res.status(200).json(stockHistory);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Scrape attempt logs (Section 24)
     * GET /api/tracked-products/:id/scrape-logs
     */
    async getScrapeLogs(req, res, next) {
        try {
            const { id } = req.params;
            const logs = await historyService.getScrapeLogs(id);
            return successResponse(res, { logs });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Latest status summary (Section 25)
     * GET /api/tracked-products/:id/status
     */
    async getStatus(req, res, next) {
        try {
            const { id } = req.params;
            const status = await historyService.getTrackedStatus(id);
            return successResponse(res, status);
        } catch (error) {
            next(error);
        }
    },
};

export default historyController;
