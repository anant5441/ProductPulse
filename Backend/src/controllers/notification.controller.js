import notificationService from "../services/notificationService.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const notificationController = {
    /**
     * List recent notifications
     * GET /api/notifications
     */
    async list(req, res, next) {
        try {
            const limit = parseInt(req.query.limit, 10) || 30;
            const offset = parseInt(req.query.offset, 10) || 0;
            const unreadOnly = req.query.unread === "true";

            const result = await notificationService.listNotifications({ limit, offset, unreadOnly });
            return successResponse(res, result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mark single notification as read
     * PATCH /api/notifications/:id/read
     */
    async markRead(req, res, next) {
        try {
            const { id } = req.params;
            if (!id) {
                return errorResponse(res, "VALIDATION_ERROR", "Notification ID is required", 400);
            }

            const updated = await notificationService.markAsRead(id);
            return successResponse(res, { notification: updated });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mark all notifications as read
     * PATCH /api/notifications/read-all
     */
    async markAllRead(req, res, next) {
        try {
            const result = await notificationService.markAllAsRead();
            return successResponse(res, result);
        } catch (error) {
            next(error);
        }
    },
};

export default notificationController;
