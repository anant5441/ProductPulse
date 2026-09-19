//  store / transport

export const DEFAULT_BASE_URL = "https://demo.inelabteamdev.com";

export const USER_AGENT =
    "Mozilla/5.0 (compatible; PricePulse/0.1; +https://github.com/pricepulse)";

export const DEFAULT_TIMEOUT = 15000;

export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// retry budgets
export const SCRAPER_RETRIES = 2;
export const CATALOG_RETRIES = 3;
export const PRODUCT_RETRIES = 3;
export const PRICE_RETRIES = 5;
export const PRICE_RETRY_DELAY_MS = 300;

// catalog
export const DEFAULT_PAGE_SIZE = 20;
// idk why but there is a internal limit of 60 on page size
export const MAX_PAGE_SIZE = 60;
export const DEFAULT_COLLECT_REQUESTS = 250;
export const DEFAULT_COLLECT_DELAY_MS = 150;

// --- catalog fill (catalog sampler -> products table) ----------------------

// PostgREST is one HTTP round trip per upsert, so rows go up in batches instead of one
// request per product
export const FILL_BATCH_SIZE = 200;

// full catalogue sweep

export const SWEEP_DELAY_MS = 120;
export const SWEEP_PROBE_GAP = 5;
export const SWEEP_MAX_REQUESTS = 2000;

//  price handshake
export const SHARED_SECRET = "ine-mock-store-shared-k3y";
export const MIN_HOVER_MOVES = 8;
export const MIN_DWELL_MS = 600;
export const POW_ATTEMPT_BUDGET = 5_000_000;
export const FINGERPRINT_HASH_BYTES = 8;
export const FINGERPRINT_CORES = 8;
export const FINGERPRINT_SCREEN = [1920, 1080, 1];
export const FINGERPRINT_FRAMES = [12.4, 16.7, 15.2, 18.1, 16.6, 17.3, 15.9, 16.2];

// parser

export const SPACED_ELEMENTS = [
    "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
    "section", "article", "header", "footer", "nav", "ul", "ol",
    "table", "blockquote", "pre", "a", "button",
].join(", ");
