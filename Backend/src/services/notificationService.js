import supabase from "../config/supabase.js";
import emailService from "./emailService.js";
import logger from "../utils/logger.js";

export const notificationService = {
    /**
     * Create notification and dispatch to enabled delivery channels
     */
    async createNotification({
        trackedProductId,
        alertType,
        title,
        message,
        previousPrice,
        currentPrice,
        previousStockStatus,
        currentStockStatus,
        preferences,
        emailContent,
    }) {
        // 1. Insert notification record
        const { data: notification, error: notifErr } = await supabase
            .from("notifications")
            .insert({
                tracked_product_id: trackedProductId,
                alert_type: alertType,
                title,
                message,
                previous_price: previousPrice != null ? Number(previousPrice) : null,
                current_price: currentPrice != null ? Number(currentPrice) : null,
                previous_stock_status: previousStockStatus || null,
                current_stock_status: currentStockStatus || null,
                is_read: false,
            })
            .select()
            .single();

        if (notifErr || !notification) {
            logger.error("Failed to create notification record:", notifErr);
            throw new Error(`Failed to create notification: ${notifErr?.message}`);
        }

        const notificationId = notification.id;

        // 2. Deliver via In-App channel if enabled
        if (preferences?.in_app_enabled) {
            const { error: inAppErr } = await supabase
                .from("notification_deliveries")
                .insert({
                    notification_id: notificationId,
                    channel: "in_app",
                    status: "sent",
                    provider: "supabase",
                    sent_at: new Date().toISOString(),
                });

            if (inAppErr) {
                logger.error("Failed to create in-app notification delivery record:", inAppErr);
            }
        }

        // 3. Deliver via Email channel if enabled
        if (preferences?.email_enabled && preferences?.email_address && emailContent) {
            // Insert delivery record in pending status
            const { data: delivery, error: deliveryErr } = await supabase
                .from("notification_deliveries")
                .insert({
                    notification_id: notificationId,
                    channel: "email",
                    status: "pending",
                    recipient: preferences.email_address,
                    provider: "sendgrid",
                })
                .select()
                .single();

            if (deliveryErr) {
                logger.error("Failed to insert pending email delivery record:", deliveryErr);
            }

            const deliveryId = delivery?.id;

            try {
                const sendResult = await emailService.sendAlertEmail({
                    to: preferences.email_address,
                    subject: emailContent.subject,
                    text: emailContent.text,
                    html: emailContent.html,
                });

                if (deliveryId) {
                    await supabase
                        .from("notification_deliveries")
                        .update({
                            status: "sent",
                            sent_at: new Date().toISOString(),
                            provider_message_id: sendResult.messageId,
                        })
                        .eq("id", deliveryId);
                }
            } catch (err) {
                logger.error(`SendGrid delivery failed for notification ${notificationId}:`, err.message);
                if (deliveryId) {
                    await supabase
                        .from("notification_deliveries")
                        .update({
                            status: "failed",
                            error_message: err.message,
                        })
                        .eq("id", deliveryId);
                }
            }
        }

        return notification;
    },

    /**
     * List recent notifications
     */
    async listNotifications({ limit = 30, offset = 0, unreadOnly = false } = {}) {
        let query = supabase
            .from("notifications")
            .select("*, tracked_products(id, product_id, is_active, products(*))")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (unreadOnly) {
            query = query.eq("is_read", false);
        }

        const { data, error } = await query;
        if (error) {
            logger.error("Failed to query notifications:", error);
            throw new Error(error.message);
        }

        const { count: unreadCount, error: countErr } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("is_read", false);

        if (countErr) {
            logger.error("Failed to count unread notifications:", countErr);
        }

        return {
            notifications: (data || []).map((n) => ({
                id: n.id,
                trackedProductId: n.tracked_product_id,
                alertType: n.alert_type,
                title: n.title,
                message: n.message,
                previousPrice: n.previous_price != null ? Number(n.previous_price) : null,
                currentPrice: n.current_price != null ? Number(n.current_price) : null,
                previousStockStatus: n.previous_stock_status,
                currentStockStatus: n.current_stock_status,
                isRead: n.is_read,
                createdAt: n.created_at,
                product: n.tracked_products?.products || null,
            })),
            unreadCount: unreadCount || 0,
        };
    },

    /**
     * Mark single notification as read
     */
    async markAsRead(id) {
        const { data, error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to mark notification as read: ${error.message}`);
        }
        return data;
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("is_read", false);

        if (error) {
            throw new Error(`Failed to mark all notifications as read: ${error.message}`);
        }
        return { success: true };
    },
};

export default notificationService;
