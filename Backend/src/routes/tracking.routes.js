import { Router } from "express";
import trackingController from "../controllers/tracking.controller.js";
import historyController from "../controllers/history.controller.js";
import alertController from "../controllers/alert.controller.js";
import { validateIdParam } from "../middleware/validation.middleware.js";

const router = Router();

// GET /api/tracked-products
router.get("/", trackingController.list);

// POST /api/tracked-products
router.post("/", trackingController.track);

// DELETE /api/tracked-products/:id
router.delete("/:id", validateIdParam("id"), trackingController.untrack);

// Historical sub-routes on tracked-products
// GET /api/tracked-products/:id/history
router.get("/:id/history", validateIdParam("id"), historyController.getHistory);

// GET /api/tracked-products/:id/price-history
router.get("/:id/price-history", validateIdParam("id"), historyController.getPriceHistory);

// GET /api/tracked-products/:id/stock-history
router.get("/:id/stock-history", validateIdParam("id"), historyController.getStockHistory);

// GET /api/tracked-products/:id/scrape-logs
router.get("/:id/scrape-logs", validateIdParam("id"), historyController.getScrapeLogs);

// GET /api/tracked-products/:id/status
router.get("/:id/status", validateIdParam("id"), historyController.getStatus);

// Alert preferences sub-routes on tracked-products (Section 22)
// GET /api/tracked-products/:id/alerts
router.get("/:id/alerts", validateIdParam("id"), alertController.getPreferences);

// PUT /api/tracked-products/:id/alerts
router.put("/:id/alerts", validateIdParam("id"), alertController.updatePreferences);

export default router;
