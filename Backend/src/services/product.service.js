import fs from "node:fs";
import path from "node:path";
import supabase from "../config/supabase.js";
import { fetchCatalogPage } from "../../Scraper/catalog.js";
import { fetchProduct } from "../../Scraper/product.js";
import { buildProductUrl } from "../utils/normalize.js";
import logger from "../utils/logger.js";

export function getCachedStoreCatalog() {
    try {
        const filePath = path.resolve(process.cwd(), "all_products.json");
        if (fs.existsSync(filePath)) {
            const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
            if (Array.isArray(raw.products)) {
                return raw.products;
            }
            if (raw.products && typeof raw.products === "object") {
                return Object.values(raw.products);
            }
            if (Array.isArray(raw)) {
                return raw;
            }
        }
    } catch {
        // Ignore fallback
    }
    return [];
}

export const productService = {
    /**
     * Search products by query across local DB and storefront
     */
    async searchProducts(query = "") {
        const q = String(query).trim();
        const results = [];
        const seenSkus = new Set();

        // 1. Search in local database
        if (q.length > 0) {
            const { data: dbProducts, error } = await supabase
                .from("products")
                .select("*")
                .or(`name.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%,sku.ilike.%${q}%`)
                .limit(20);

            if (!error && Array.isArray(dbProducts)) {
                for (const p of dbProducts) {
                    seenSkus.add(p.sku);
                    results.push({
                        id: p.id,
                        externalId: p.external_id,
                        name: p.name,
                        brand: p.brand,
                        category: p.category,
                        sku: p.sku,
                        productUrl: p.product_url,
                        imageUrl: p.image_url,
                        description: p.description,
                        isStoredLocally: true,
                    });
                }
            }
        }

        // 2. Search local cached store catalogue
        const cachedStore = getCachedStoreCatalog();
        const qLower = q.toLowerCase();

        for (const item of cachedStore) {
            if (seenSkus.has(item.sku)) continue;

            const matches =
                !q ||
                (item.name && item.name.toLowerCase().includes(qLower)) ||
                (item.brand && item.brand.toLowerCase().includes(qLower)) ||
                (item.category && item.category.toLowerCase().includes(qLower)) ||
                (item.sku && item.sku.toLowerCase().includes(qLower));

            if (matches) {
                seenSkus.add(item.sku);
                
                // Upsert to database so it gets a UUID
                const upserted = await this.upsertProduct({
                    external_id: String(item.id),
                    name: item.name,
                    brand: item.brand,
                    category: item.category,
                    sku: item.sku,
                    product_url: buildProductUrl(item.id),
                    description: item.description,
                    specifications: item.specs || {},
                    source: "ine-store",
                });

                results.push({
                    id: upserted?.id || item.id,
                    externalId: String(item.id),
                    name: item.name,
                    brand: item.brand,
                    category: item.category,
                    sku: item.sku,
                    productUrl: buildProductUrl(item.id),
                    imageUrl: null,
                    description: item.description,
                    isStoredLocally: Boolean(upserted?.id),
                });

                if (results.length >= 30) break;
            }
        }

        // 3. If still empty, fetch page from live storefront catalog
        if (results.length === 0) {
            try {
                const catalogPage = await fetchCatalogPage(1, { pageSize: 20 });
                for (const item of catalogPage.items) {
                    if (seenSkus.has(item.sku)) continue;

                    const matches =
                        !q ||
                        (item.name && item.name.toLowerCase().includes(qLower)) ||
                        (item.brand && item.brand.toLowerCase().includes(qLower)) ||
                        (item.category && item.category.toLowerCase().includes(qLower)) ||
                        (item.sku && item.sku.toLowerCase().includes(qLower));

                    if (matches) {
                        seenSkus.add(item.sku);

                        const upserted = await this.upsertProduct({
                            external_id: String(item.id),
                            name: item.name,
                            brand: item.brand,
                            category: item.category,
                            sku: item.sku,
                            product_url: buildProductUrl(item.id),
                            description: item.description,
                            source: "ine-store",
                        });

                        results.push({
                            id: upserted?.id || item.id,
                            externalId: String(item.id),
                            name: item.name,
                            brand: item.brand,
                            category: item.category,
                            sku: item.sku,
                            productUrl: buildProductUrl(item.id),
                            imageUrl: null,
                            description: item.description,
                            isStoredLocally: Boolean(upserted?.id),
                        });
                    }
                }
            } catch (err) {
                logger.warn("Live catalog search fallback failed:", err.message);
            }
        }

        return results;
    },

    /**
     * Get single product by UUID or externalId with tracking & latest observation
     */
    async getProductById(id) {
        // Query by UUID or external_id
        let query = supabase.from("products").select("*");
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            query = query.eq("id", id);
        } else {
            query = query.eq("external_id", String(id));
        }

        const { data: product, error } = await query.maybeSingle();

        if (error || !product) {
            // Try fetching from storefront product API directly if not in DB
            if (/^\d+$/.test(id)) {
                try {
                    const fetched = await fetchProduct(parseInt(id, 10));
                    const upserted = await this.upsertProduct({
                        external_id: String(id),
                        name: fetched.name,
                        brand: fetched.brand,
                        category: fetched.category,
                        sku: fetched.sku,
                        product_url: buildProductUrl(id),
                        description: fetched.description,
                        specifications: fetched.specs || {},
                        source: "ine-store",
                    });
                    return this.getProductById(upserted.id);
                } catch {
                    return null;
                }
            }
            return null;
        }

        // Get tracking status
        const { data: tracking } = await supabase
            .from("tracked_products")
            .select("*")
            .eq("product_id", product.id)
            .eq("is_active", true)
            .maybeSingle();

        // Get latest observation if tracked
        let latestObservation = null;
        if (tracking) {
            const { data: latestPrice } = await supabase
                .from("price_history")
                .select("*")
                .eq("tracked_product_id", tracking.id)
                .order("scraped_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestPrice) {
                latestObservation = {
                    price: latestPrice.price,
                    originalPrice: latestPrice.original_price,
                    discount: latestPrice.discount_percentage,
                    stock: latestPrice.stock,
                    stockStatus: latestPrice.stock_status,
                    seller: latestPrice.seller_name,
                    scrapedAt: latestPrice.scraped_at,
                };
            }
        }

        return {
            product,
            tracking: tracking || null,
            latestObservation,
        };
    },

    /**
     * Upsert a product into products table based on sku or external_id (Section 40)
     */
    async upsertProduct(productData) {
        const payload = {
            external_id: productData.external_id ? String(productData.external_id) : null,
            name: productData.name,
            brand: productData.brand || "INE Brand",
            category: productData.category || "General",
            sku: productData.sku,
            product_url: productData.product_url,
            image_url: productData.image_url || null,
            description: productData.description || "",
            about_item: productData.about_item || null,
            currency: productData.currency || "₹",
            specifications: productData.specifications || {},
            metadata: productData.metadata || {},
            source: productData.source || "ine-store",
            is_active: productData.is_active !== false,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from("products")
            .upsert(payload, { onConflict: "sku" })
            .select()
            .single();

        if (error) {
            logger.error("Failed to upsert product:", error);
            // If conflict or write failed, attempt lookup
            const { data: existing } = await supabase
                .from("products")
                .select("*")
                .eq("sku", productData.sku)
                .maybeSingle();
            return existing;
        }

        return data;
    },

    /**
     * Batch Sync all products from all_products.json or store into Supabase
     */
    async syncAllProducts(batchSize = 50) {
        logger.info("[productService.syncAllProducts] Starting product database sync...");
        const items = getCachedStoreCatalog();

        if (items.length === 0) {
            throw new Error("No products found in local cache (all_products.json).");
        }

        let insertedCount = 0;
        let failedCount = 0;
        const total = items.length;

        for (let i = 0; i < total; i += batchSize) {
            const batch = items.slice(i, i + batchSize).map((item) => ({
                external_id: String(item.id),
                name: item.name,
                brand: item.brand || "INE Brand",
                category: item.category || "General",
                sku: item.sku,
                product_url: buildProductUrl(item.id),
                image_url: item.image_url || null,
                description: item.description || "",
                specifications: item.specs || {},
                metadata: {
                    slug: item.slug,
                    reviews: item.reviews || [],
                },
                source: "ine-store",
                is_active: true,
                updated_at: new Date().toISOString(),
            }));

            const { data, error } = await supabase
                .from("products")
                .upsert(batch, { onConflict: "sku" })
                .select("id, sku");

            if (error) {
                logger.error(`[syncAllProducts] Batch ${i / batchSize + 1} failed:`, error.message);
                failedCount += batch.length;
            } else {
                insertedCount += (data ? data.length : batch.length);
            }
        }

        logger.info(`[productService.syncAllProducts] Finished. ${insertedCount}/${total} products synced to Supabase.`);
        return {
            totalProducts: total,
            syncedCount: insertedCount,
            failedCount,
        };
    },

    /**
     * List all products with pagination and category filtering
     */
    async listProducts({ page = 1, limit = 20, category = null, brand = null, search = null } = {}) {
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const offset = (parsedPage - 1) * parsedLimit;

        let query = supabase
            .from("products")
            .select("*", { count: "exact" })
            .range(offset, offset + parsedLimit - 1)
            .order("created_at", { ascending: false });

        if (category) query = query.eq("category", category);
        if (brand) query = query.eq("brand", brand);
        if (search) {
            query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        return {
            page: parsedPage,
            limit: parsedLimit,
            total: count || 0,
            pages: Math.ceil((count || 0) / parsedLimit),
            products: data || [],
        };
    },
};

export default productService;
