/**
 * Structured Logger for ProductPulse
 */
export const logger = {
    info(message, meta = {}) {
        console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : "");
    },
    warn(message, meta = {}) {
        console.warn(`[WARN] ${message}`, Object.keys(meta).length ? meta : "");
    },
    error(message, meta = {}) {
        console.error(`[ERROR] ${message}`, Object.keys(meta).length ? meta : "");
    },

    scrapeStart(trackedProductId, meta = {}) {
        console.log(`[SCRAPE_START] trackedProductId=${trackedProductId}`, meta);
    },
    scrapeAttempt(trackedProductId, attemptNumber, meta = {}) {
        console.log(`[SCRAPE_ATTEMPT] trackedProductId=${trackedProductId} attempt=${attemptNumber}`, meta);
    },
    scrapeSuccess(trackedProductId, price, meta = {}) {
        console.log(`[SCRAPE_SUCCESS] trackedProductId=${trackedProductId} price=${price}`, meta);
    },
    scrapeFailure(trackedProductId, error, meta = {}) {
        console.error(`[SCRAPE_FAILURE] trackedProductId=${trackedProductId} error=${error}`, meta);
    },
};

export default logger;
