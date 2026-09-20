import { Router } from "express";
import alertController from "../controllers/alert.controller.js";

const router = Router({ mergeParams: true });

// GET /api/tracked-products/:trackingId/alerts
router.get("/:trackingId/alerts", alertController.getPreferences);

// PUT /api/tracked-products/:trackingId/alerts
router.put("/:trackingId/alerts", alertController.updatePreferences);

export default router;
