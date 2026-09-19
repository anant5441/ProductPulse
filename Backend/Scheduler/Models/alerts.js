import supabase from "../../src/config/supabase.js";
import logger from "../../src/utils/logger.js";

// In-memory fallback alert store if database alerts table is not yet migrated
const memoryAlerts = new Map();

/**
 * List active alerts for a given product ID.
 */
export async function listActive(productId) {
    try {
        const { data, error } = await supabase
            .from("alerts")
            .select("*")
            .eq("product_id", productId)
            .eq("is_active", true);

        if (!error && Array.isArray(data)) {
            return data;
        }
    } catch {
        // Table not present, fallback to in-memory store
    }

    // Fallback: in-memory store
    const productAlerts = [];
    for (const [id, alert] of memoryAlerts.entries()) {
        if ((alert.product_id === productId || alert.productId === productId) && alert.is_active) {
            productAlerts.push({ id, ...alert });
        }
    }
    return productAlerts;
}

/**
 * Mark an alert as triggered.
 */
export async function markTriggered(alertId) {
    try {
        const { data, error } = await supabase
            .from("alerts")
            .update({
                is_active: false,
                last_triggered_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", alertId)
            .select()
            .maybeSingle();

        if (!error && data) {
            return data;
        }
    } catch {
        // Table not present, fallback to in-memory
    }

    if (memoryAlerts.has(alertId)) {
        const alert = memoryAlerts.get(alertId);
        alert.is_active = false;
        alert.last_triggered_at = new Date().toISOString();
        memoryAlerts.set(alertId, alert);
        return alert;
    }

    return null;
}

/**
 * Create a new alert.
 */
export async function createAlert({ productId, type = "price_drop", targetPrice = null }) {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAlert = {
        id: alertId,
        product_id: productId,
        type,
        target_price: targetPrice,
        is_active: true,
        created_at: new Date().toISOString(),
    };

    try {
        const { data, error } = await supabase
            .from("alerts")
            .insert(newAlert)
            .select()
            .maybeSingle();

        if (!error && data) {
            return data;
        }
    } catch {
        // Table not present
    }

    memoryAlerts.set(alertId, newAlert);
    return newAlert;
}

export default {
    listActive,
    markTriggered,
    createAlert,
};
