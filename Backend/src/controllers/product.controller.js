import productService from "../services/product.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const productController = {
    /**
     * Search products by partial/full query (Section 11)
     * GET /api/products/search?q=domus
     */
    async search(req, res, next) {
        try {
            const query = req.query.q || "";
            const products = await productService.searchProducts(query);
            return successResponse(res, { products });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get single product with tracking & latest observation (Section 12)
     * GET /api/products/:id
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const data = await productService.getProductById(id);

            if (!data) {
                return errorResponse(res, "PRODUCT_NOT_FOUND", `Product not found with ID: ${id}`, 404);
            }

            return successResponse(res, data);
        } catch (error) {
            next(error);
        }
    },
    /**
     * List all products with pagination
     * GET /api/products
     */
    async list(req, res, next) {
        try {
            const { page, limit, category, brand, search } = req.query;
            const result = await productService.listProducts({ page, limit, category, brand, search });
            return successResponse(res, result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Sync all products from catalog cache to Supabase
     * POST /api/products/sync or GET /api/products/sync
     */
    async sync(req, res, next) {
        try {
            const batchSize = parseInt(req.query.batchSize || req.body?.batchSize, 10) || 50;
            const result = await productService.syncAllProducts(batchSize);
            return successResponse(res, {
                message: "Catalog sync to Supabase completed successfully",
                ...result,
            });
        } catch (error) {
            next(error);
        }
    },
};

export default productController;
