import { Router } from "express";
import notificationController from "../controllers/notification.controller.js";

const router = Router();

// GET /api/notifications
router.get("/", notificationController.list);

// PATCH /api/notifications/read-all (must be registered before /:id/read)
router.patch("/read-all", notificationController.markAllRead);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", notificationController.markRead);

export default router;
