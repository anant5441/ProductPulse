import ENV from "../config/env.js";

/**
 * Extract external ID from product URL or ID string
 * e.g., "https://demo.inelabteamdev.com/product/291" -> "291"
 */
export function extractExternalId(input) {
    if (!input) return null;
    const str = String(input).trim();
    
    // Check if it's already a numeric ID
    if (/^\d+$/.test(str)) {
        return str;
    }
    
    const match = str.match(/\/product\/(\d+)/i);
    return match ? match[1] : str;
}

/**
 * Build canonical storefront product URL from ID
 */
export function buildProductUrl(externalId) {
    const id = extractExternalId(externalId);
    return `${ENV.STORE_BASE_URL.replace(/\/$/, "")}/product/${id}`;
}

/**
 * Clean text strings (remove zero-width chars and normalize whitespace)
 */
export function cleanText(value) {
    if (!value) return "";
    return String(value)
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
