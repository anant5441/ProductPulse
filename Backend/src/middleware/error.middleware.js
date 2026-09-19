import { errorResponse } from "../utils/response.js";
import logger from "../utils/logger.js";
import ENV from "../config/env.js";

/**
 * 404 Route Not Found Middleware
 */
export function notFoundHandler(req, res) {
    return errorResponse(res, "NOT_FOUND", `Cannot ${req.method} ${req.originalUrl}`, 404);
}

/**
 * Global Error Handler Middleware
 */
export function globalErrorHandler(err, req, res, next) {
    const status = err.statusCode || err.status || 500;
    const code = err.code || "INTERNAL_ERROR";
    const message = err.message || "An unexpected error occurred.";

    logger.error(`[API ERROR] ${req.method} ${req.originalUrl} - ${status} ${code}: ${message}`);

    const details = ENV.NODE_ENV === "development" ? err.stack : undefined;
    return errorResponse(res, code, message, status, details);
}
