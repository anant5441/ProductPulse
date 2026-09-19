import { errorResponse } from "../utils/response.js";

/**
 * Validates that an ID param exists and is non-empty
 */
export function validateIdParam(paramName = "id") {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!id || typeof id !== "string" || id.trim().length === 0) {
            return errorResponse(res, "INVALID_ID", `Missing or invalid parameter: ${paramName}`, 400);
        }
        next();
    };
}
