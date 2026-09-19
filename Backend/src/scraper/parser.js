import { cleanText } from "../utils/normalize.js";

/**
 * Parses stock strings adhering to Section 20 of specifications:
 * - OUT OF STOCK -> status: "out_of_stock", quantity: null
 * - 157 IN STOCK -> status: "in_stock", quantity: 157
 * - IN STOCK -> status: "in_stock", quantity: null
 */
export function parseStockStatus(rawStockText, quoteStock) {
    // If quote stock is available from price handshake
    if (typeof quoteStock === "number") {
        if (quoteStock === 0) {
            return {
                status: "out_of_stock",
                quantity: null,
            };
        }
        return {
            status: "in_stock",
            quantity: quoteStock,
        };
    }

    if (!rawStockText) {
        return {
            status: "in_stock",
            quantity: null,
        };
    }

    const text = cleanText(rawStockText).toLowerCase();

    if (/out\s+of\s+stock/i.test(text)) {
        return {
            status: "out_of_stock",
            quantity: null,
        };
    }

    const match = text.match(/(\d[\d,]*)\s*(?:in\s+stock|available)/i);
    if (match) {
        const qty = parseInt(match[1].replace(/,/g, ""), 10);
        return {
            status: qty > 0 ? "in_stock" : "out_of_stock",
            quantity: qty > 0 ? qty : null,
        };
    }

    if (/in\s+stock/i.test(text)) {
        return {
            status: "in_stock",
            quantity: null,
        };
    }

    return {
        status: "in_stock",
        quantity: null,
    };
}
