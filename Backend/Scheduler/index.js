import runDueScrapes, {
    mapQuote,
    evaluateAlerts,
    RETRY_DELAY_MINUTES,
    DEFAULT_SCRAPE_FREQUENCY_MINUTES,
} from "./run.js";

import trackedProducts from "./Models/trackedProducts.js";
import priceHistory from "./Models/priceHistory.js";
import scrapeLog from "./Models/scrapeLog.js";
import alerts from "./Models/alerts.js";

export {
    runDueScrapes,
    mapQuote,
    evaluateAlerts,
    RETRY_DELAY_MINUTES,
    DEFAULT_SCRAPE_FREQUENCY_MINUTES,
    trackedProducts,
    priceHistory,
    scrapeLog,
    alerts,
};

export default runDueScrapes;
