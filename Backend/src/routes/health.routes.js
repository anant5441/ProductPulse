import { Router } from "express";
import { successResponse } from "../utils/response.js";

const router = Router();

/**
 * Health check endpoint (Section 10 & 35)
 * GET /api/health
 */
router.get("/health", (req, res) => {
    return successResponse(res, {
        status: "ok",
        service: "productpulse-backend",
    });
});

export default router;
