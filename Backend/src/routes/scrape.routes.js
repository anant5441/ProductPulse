import { Router } from "express";
import scrapeController from "../controllers/scrape.controller.js";
import { requireCronSecret } from "../middleware/cron.middleware.js";
import { validateIdParam } from "../middleware/validation.middleware.js";

const router = Router();

// POST /api/scrape/product/:trackedProductId (Manual trigger)
router.post("/product/:trackedProductId", validateIdParam("trackedProductId"), scrapeController.scrapeProduct);

// POST /api/cron/scrape (External cron job trigger)
router.post("/cron/scrape", requireCronSecret, scrapeController.runCron);

// POST /api/scheduler/run-due or /api/scrape/run-due
router.post("/scheduler/run-due", scrapeController.runScheduler);
router.post("/run-due", scrapeController.runScheduler);

export default router;
