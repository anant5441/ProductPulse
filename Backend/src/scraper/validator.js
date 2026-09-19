/**
 * Scraper Data Validation Rules (Sections 31 & 32)
 */
export function validateScrapedProduct(data) {
    const errors = [];

    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
        errors.push("Product name is missing or empty");
    }

    if (!data.sku || typeof data.sku !== "string" || data.sku.trim().length === 0) {
        errors.push("Product SKU is missing or empty");
    }

    if (data.currentPrice === null || data.currentPrice === undefined || isNaN(data.currentPrice) || data.currentPrice <= 0) {
        errors.push(`Invalid or missing current price: ${data.currentPrice}`);
    }

    if (!data.stockStatus) {
        errors.push("Stock status is missing");
    }

    if (data.originalPrice !== null && data.originalPrice !== undefined && data.currentPrice !== null) {
        if (data.originalPrice < data.currentPrice) {
            errors.push(`Original price (${data.originalPrice}) is lower than current price (${data.currentPrice})`);
        }
    }

    if (data.discount !== null && data.discount !== undefined) {
        if (data.discount < 0 || data.discount > 100) {
            errors.push(`Discount percentage out of bounds (0-100): ${data.discount}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
