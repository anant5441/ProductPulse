import ENV from "../config/env.js";
import { errorResponse } from "../utils/response.js";

/**
 * Validates x-cron-secret header for external cron triggers (Section 26)
 */
export function requireCronSecret(req, res, next) {
    const providedSecret = req.headers["x-cron-secret"];

    if (!providedSecret || providedSecret !== ENV.CRON_SECRET) {
        return errorResponse(res, "UNAUTHORIZED", "Invalid or missing cron secret header.", 401);
    }

    next();
}
