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

                const emailSubject = `Price dropped: ${productName}`;
                const emailText = `Price Drop Alert\n\n${productName}\n\nPrevious price: ${formattedPrev}\nCurrent price: ${formattedCurr}\nYou save: ${formattedDrop}\n\nOpen ProductPulse to view the latest price history.`;
                const emailHtml = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #0f172a; margin-top: 0;">🔻 Price Drop Alert</h2>
                        <h3 style="color: #6C3BFF; margin-bottom: 16px;">${productName}</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b;">Previous price:</td>
                                <td style="padding: 8px 0; font-weight: 600; text-decoration: line-through;">${formattedPrev}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b;">Current price:</td>
                                <td style="padding: 8px 0; font-weight: bold; color: #059669; font-size: 18px;">${formattedCurr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b;">You save:</td>
                                <td style="padding: 8px 0; font-weight: bold; color: #059669;">${formattedDrop}</td>
                            </tr>
                        </table>
                        <p style="color: #475569; font-size: 14px;">Open ProductPulse to view the latest price history and analytics.</p>
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

                const emailSubject = `Back in stock: ${productName}`;
                const emailText = `Back in Stock\n\n${productName} is now back in stock.\n\nCurrent price: ${formattedCurr}\n\nOpen ProductPulse to view the product.`;
                const emailHtml = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #059669; margin-top: 0;">🟢 Back in Stock</h2>
                        <h3 style="color: #0f172a; margin-bottom: 16px;">${productName}</h3>
                        <p style="color: #334155; font-size: 15px;">This item is now back in stock and available for purchase!</p>
                        <p style="color: #0f172a; font-size: 18px; font-weight: bold; margin: 16px 0;">Current price: ${formattedCurr}</p>
                        <p style="color: #475569; font-size: 14px;">Open ProductPulse to view the product details.</p>
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
