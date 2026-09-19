import { scrapeProduct as apiScrapeProduct } from "../../Scraper/scraper.js";
import { fetchProduct as apiFetchProduct } from "../../Scraper/product.js";
import { fetchPrice as apiFetchPrice } from "../../Scraper/price.js";
import { parseStockStatus } from "./parser.js";
import { buildProductUrl, extractExternalId } from "../utils/normalize.js";
import ENV from "../config/env.js";

/**
 * Executes scraping for a single product.
 * Combines fast, reliable cryptographic handshake with structured schema validation.
 *
 * @param {string|number} externalId Product external ID or URL
 * @param {object} options Options override
 * @returns {Promise<object>} Structured product payload
 */
export async function scrapeProductData(externalId, options = {}) {
    const id = parseInt(extractExternalId(externalId), 10);
    if (!Number.isInteger(id) || id < 1) {
        throw new Error(`Invalid external product id: ${externalId}`);
    }

    const url = buildProductUrl(id);
    const baseUrl = options.baseUrl || ENV.STORE_BASE_URL;

    // Fetch product details and decrypted quote
    const record = await apiScrapeProduct(id, { baseUrl });

    const stockInfo = parseStockStatus(null, record.stock);

    return {
        url,
        externalId: String(id),
        name: record.name,
        brand: record.brand || "INE Brand",
        category: record.category || "General",
        sku: record.sku,
        originalPrice: record.mrp ?? record.price,
        currentPrice: record.price,
        discount: record.badgePct ?? 0,
        stockStatus: stockInfo.status,
        stockQuantity: stockInfo.quantity,
        delivery: record.deliveryDays ? `Get it in ${record.deliveryDays} days` : null,
        deliveryDate: record.deliveryDays ? new Date(Date.now() + record.deliveryDays * 86400000).toISOString().split("T")[0] : null,
        ratings: record.rating ? `${record.rating}★` : null,
        rating: record.rating ?? null,
        ratingCount: record.ratingCount ?? null,
        seller: record.seller ?? null,
        description: record.description ?? "",
        specifications: record.specs ?? {},
        reviews: record.reviews ?? [],
        scrapedAt: new Date().toISOString(),
        raw_data: record,
    };
}
