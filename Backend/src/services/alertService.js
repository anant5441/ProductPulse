import supabase from "../config/supabase.js";
import notificationService from "./notificationService.js";
import logger from "../utils/logger.js";

const DEFAULT_PREFERENCES = {
    price_drop_enabled: true,
    price_drop_threshold: 0,
    back_in_stock_enabled: true,
    in_app_enabled: true,
    email_enabled: false,
    email_address: null,
    cooldown_minutes: 120,
};

export const alertService = {
    /**
     * Get alert preferences for a tracked product (creates defaults if not found)
     */
    async getPreferences(trackedProductId) {
        const { data, error } = await supabase
            .from("alert_preferences")
            .select("*")
            .eq("tracked_product_id", trackedProductId)
            .maybeSingle();

        if (error) {
            logger.error(`Error fetching alert preferences for ${trackedProductId}:`, error);
            throw new Error(error.message);
        }

        if (!data) {
            return {
                tracked_product_id: trackedProductId,
                ...DEFAULT_PREFERENCES,
            };
        }

        return data;
    },

    /**
     * Upsert alert preferences for a tracked product
     */
    async upsertPreferences(trackedProductId, updates) {
        // Validate inputs
        if (updates.priceDropThreshold !== undefined && Number(updates.priceDropThreshold) < 0) {
            const err = new Error("priceDropThreshold must be a non-negative number.");
            err.statusCode = 400;
            throw err;
        }

        if (updates.cooldownMinutes !== undefined && Number(updates.cooldownMinutes) < 0) {
            const err = new Error("cooldownMinutes must be a non-negative number.");
            err.statusCode = 400;
            throw err;
        }

        if (updates.emailEnabled && updates.emailAddress) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updates.emailAddress)) {
                const err = new Error("Invalid emailAddress format.");
                err.statusCode = 400;
                throw err;
            }
        }

        const payload = {
            tracked_product_id: trackedProductId,
            price_drop_enabled: updates.priceDropEnabled !== undefined ? Boolean(updates.priceDropEnabled) : true,
            price_drop_threshold: updates.priceDropThreshold !== undefined ? Number(updates.priceDropThreshold) : 0,
            back_in_stock_enabled: updates.backInStockEnabled !== undefined ? Boolean(updates.backInStockEnabled) : true,
            in_app_enabled: updates.inAppEnabled !== undefined ? Boolean(updates.inAppEnabled) : true,
            email_enabled: updates.emailEnabled !== undefined ? Boolean(updates.emailEnabled) : false,
            email_address: updates.emailAddress ? String(updates.emailAddress).trim() : null,
            cooldown_minutes: updates.cooldownMinutes !== undefined ? parseInt(updates.cooldownMinutes, 10) : 120,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from("alert_preferences")
            .upsert(payload, { onConflict: "tracked_product_id" })
            .select()
            .single();

        if (error) {
            logger.error(`Failed to upsert alert preferences for ${trackedProductId}:`, error);
            throw new Error(`Failed to save preferences: ${error.message}`);
        }

        return data;
    },

    /**
     * Check if an alert of the specified type is inside its cooldown window
     */
    async isWithinCooldown(trackedProductId, alertType, cooldownMinutes) {
        if (!cooldownMinutes || cooldownMinutes <= 0) return false;

        const { data: recentNotif, error } = await supabase
            .from("notifications")
            .select("created_at")
            .eq("tracked_product_id", trackedProductId)
            .eq("alert_type", alertType)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !recentNotif) return false;

        const lastNotifTime = new Date(recentNotif.created_at).getTime();
        const diffMinutes = (Date.now() - lastNotifTime) / (1000 * 60);

        return diffMinutes < cooldownMinutes;
    },

    /**
     * Main Alert Evaluation Logic
     * Evaluates price-drop and back-in-stock conditions after a successful scrape
     */
    async evaluateAlerts({ trackedProduct, previousObservation, currentObservation }) {
        // Section 6: First scrape - never generate an alert when there is no previous observation
        if (!previousObservation || !currentObservation) {
            logger.info("Alert evaluation skipped: No previous observation to compare against.");
            return { evaluated: false, reason: "NO_PREVIOUS_OBSERVATION" };
        }

        const trackedProductId = trackedProduct.id;
        const productName = trackedProduct.products?.name || "Tracked Product";

        // Load preferences
        const preferences = await this.getPreferences(trackedProductId);

        const currentPrice = Number(currentObservation.price);
        const previousPrice = Number(previousObservation.price);
        const currentStock = currentObservation.stock_status;
        const previousStock = previousObservation.stock_status;

        const generatedAlerts = [];

        // 1. Price Drop Evaluation (Section 7)
        const priceDrop = previousPrice - currentPrice;
        const threshold = Number(preferences.price_drop_threshold || 0);

        if (preferences.price_drop_enabled && priceDrop > 0 && priceDrop >= threshold) {
            const isCoolingDown = await this.isWithinCooldown(
                trackedProductId,
                "price_drop",
                preferences.cooldown_minutes
            );

            if (isCoolingDown) {
                logger.info(`Price drop alert skipped due to active cooldown (${preferences.cooldown_minutes}m) for ${productName}`);
            } else {
                const formattedPrev = `₹${previousPrice.toLocaleString("en-IN")}`;
                const formattedCurr = `₹${currentPrice.toLocaleString("en-IN")}`;
                const formattedDrop = `₹${priceDrop.toLocaleString("en-IN")}`;

                const title = `🔻 Price dropped: ${productName}`;
                const message = `${productName} dropped by ${formattedDrop} (${formattedPrev} → ${formattedCurr})`;

                const emailSubject = `Good news! Price dropped on ${productName}`;
                const emailText = `Hi there,\n\nGreat news! The price of ${productName} has just dropped on the store.\n\n• New Price: ${formattedCurr}\n• Previous Price: ${formattedPrev}\n• Total Savings: ${formattedDrop}\n\nYou can view the full price history and details in your ProductPulse dashboard.\n\nBest regards,\nYour ProductPulse Team\n\n---\nYou are receiving this alert because you enabled price drop notifications on ProductPulse.`;
                const emailHtml = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b; line-height: 1.6;">
                        <div style="margin-bottom: 20px;">
                            <span style="display: inline-block; padding: 4px 12px; background-color: #fee2e2; color: #b91c1c; font-weight: 600; font-size: 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">🔻 Price Dropped</span>
                        </div>
                        <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Good news! The price has dropped</h2>
                        <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">
                            We noticed that <strong>${productName}</strong> just became cheaper on the store.
                        </p>
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;">Previous Price:</td>
                                    <td style="padding: 6px 0; font-weight: 500; text-align: right; text-decoration: line-through; color: #94a3b8;">${formattedPrev}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">Current Price:</td>
                                    <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #059669; font-size: 18px;">${formattedCurr}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #059669; font-weight: 600; border-top: 1px dashed #cbd5e1;">You Save:</td>
                                    <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #059669; border-top: 1px dashed #cbd5e1;">${formattedDrop}</td>
                                </tr>
                            </table>
                        </div>
                        <p style="color: #64748b; font-size: 13px; margin: 0 0 20px 0;">
                            Open your ProductPulse dashboard anytime to track historical trends, stock status, and price movements.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
                        <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
                            You received this automated notification because you enabled price drop alerts for this product on ProductPulse.
                        </p>
                    </div>
                `;

                const notif = await notificationService.createNotification({
                    trackedProductId,
                    alertType: "price_drop",
                    title,
                    message,
                    previousPrice,
                    currentPrice,
                    previousStockStatus: previousStock,
                    currentStockStatus: currentStock,
                    preferences,
                    emailContent: {
                        subject: emailSubject,
                        text: emailText,
                        html: emailHtml,
                    },
                });

                generatedAlerts.push(notif);
                logger.info(`Created price_drop alert for ${productName} (Saved: ${formattedDrop})`);
            }
        }

        // 2. Back in Stock Evaluation (Section 8)
        if (
            preferences.back_in_stock_enabled &&
            previousStock === "out_of_stock" &&
            currentStock === "in_stock"
        ) {
            const isCoolingDown = await this.isWithinCooldown(
                trackedProductId,
                "back_in_stock",
                preferences.cooldown_minutes
            );

            if (isCoolingDown) {
                logger.info(`Back in stock alert skipped due to active cooldown (${preferences.cooldown_minutes}m) for ${productName}`);
            } else {
                const formattedCurr = `₹${currentPrice.toLocaleString("en-IN")}`;
                const title = `🟢 Back in stock: ${productName}`;
                const message = `${productName} is now back in stock at ${formattedCurr}!`;

                const emailSubject = `Good news! ${productName} is back in stock`;
                const emailText = `Hi there,\n\nGreat news! ${productName} is now back in stock and ready to order.\n\n• Current Price: ${formattedCurr}\n• Status: In Stock\n\nYou can view the product details directly in your ProductPulse dashboard.\n\nBest regards,\nYour ProductPulse Team\n\n---\nYou are receiving this alert because you enabled back-in-stock notifications on ProductPulse.`;
                const emailHtml = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b; line-height: 1.6;">
                        <div style="margin-bottom: 20px;">
                            <span style="display: inline-block; padding: 4px 12px; background-color: #dcfce7; color: #15803d; font-weight: 600; font-size: 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">🟢 Back in Stock</span>
                        </div>
                        <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Good news! An item is back in stock</h2>
                        <p style="color: #475569; font-size: 15px; margin: 0 0 20px 0;">
                            <strong>${productName}</strong> is available again on the store!
                        </p>
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;">Current Price:</td>
                                    <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0f172a; font-size: 18px;">${formattedCurr}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;">Availability:</td>
                                    <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #059669;">In Stock</td>
                                </tr>
                            </table>
                        </div>
                        <p style="color: #64748b; font-size: 13px; margin: 0 0 20px 0;">
                            Open your ProductPulse dashboard anytime to track historical trends, stock status, and price movements.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
                        <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
                            You received this automated notification because you enabled back-in-stock alerts for this product on ProductPulse.
                        </p>
                    </div>
                `;

                const notif = await notificationService.createNotification({
                    trackedProductId,
                    alertType: "back_in_stock",
                    title,
                    message,
                    previousPrice,
                    currentPrice,
                    previousStockStatus: previousStock,
                    currentStockStatus: currentStock,
                    preferences,
                    emailContent: {
                        subject: emailSubject,
                        text: emailText,
                        html: emailHtml,
                    },
                });

                generatedAlerts.push(notif);
                logger.info(`Created back_in_stock alert for ${productName}`);
            }
        }

        return {
            evaluated: true,
            alertsCreated: generatedAlerts.length,
            alerts: generatedAlerts,
        };
    },
};

export default alertService;
