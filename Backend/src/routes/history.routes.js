import { Router } from "express";
import historyController from "../controllers/history.controller.js";
import { validateIdParam } from "../middleware/validation.middleware.js";

const router = Router();

// Dedicated history subrouter (also mounted on tracked-products)
router.get("/:id", validateIdParam("id"), historyController.getHistory);
router.get("/:id/prices", validateIdParam("id"), historyController.getPriceHistory);
router.get("/:id/stocks", validateIdParam("id"), historyController.getStockHistory);
router.get("/:id/logs", validateIdParam("id"), historyController.getScrapeLogs);

export default router;
