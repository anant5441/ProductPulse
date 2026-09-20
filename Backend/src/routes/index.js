import { Router } from "express";
import healthRoutes from "./health.routes.js";
import productRoutes from "./product.routes.js";
import trackingRoutes from "./tracking.routes.js";
import scrapeRoutes from "./scrape.routes.js";
import schedulerRoutes from "./scheduler.routes.js";
import historyRoutes from "./history.routes.js";
import notificationRoutes from "./notification.routes.js";

const router = Router();

// /api/health
router.use("/", healthRoutes);

// /api/products
router.use("/products", productRoutes);

// /api/tracked-products
router.use("/tracked-products", trackingRoutes);

// /api/notifications (Section 20)
router.use("/notifications", notificationRoutes);

// /api/scheduler
router.use("/scheduler", schedulerRoutes);

// /api/scrape and /api/cron
router.use("/scrape", scrapeRoutes);
router.use("/", scrapeRoutes);

// /api/history
router.use("/history", historyRoutes);

export default router;
