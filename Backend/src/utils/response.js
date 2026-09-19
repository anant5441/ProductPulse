/**
 * Standard Success Response
 * @param {Response} res Express response object
 * @param {any} data Response payload
 * @param {number} status HTTP status code (default 200)
 */
export function successResponse(res, data = {}, status = 200) {
    return res.status(status).json({
        success: true,
        data,
    });
}

/**
 * Standard Error Response
 * @param {Response} res Express response object
 * @param {string} code Error code string
 * @param {string} message Human readable message
 * @param {number} status HTTP status code (default 500)
 * @param {any} details Additional error metadata (optional)
 */
export function errorResponse(res, code = "INTERNAL_ERROR", message = "An error occurred", status = 500, details = undefined) {
    const errorPayload = {
        code,
        message,
    };

    if (details !== undefined) {
        errorPayload.details = details;
    }

    return res.status(status).json({
        success: false,
        error: errorPayload,
    });
}
