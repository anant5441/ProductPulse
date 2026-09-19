import { Router } from "express";
import productController from "../controllers/product.controller.js";
import { validateIdParam } from "../middleware/validation.middleware.js";

const router = Router();

// GET /api/products
router.get("/", productController.list);

// POST /api/products/sync or GET /api/products/sync
router.post("/sync", productController.sync);
router.get("/sync", productController.sync);

// GET /api/products/search?q=domus
router.get("/search", productController.search);

// GET /api/products/:id
router.get("/:id", validateIdParam("id"), productController.getById);

export default router;
