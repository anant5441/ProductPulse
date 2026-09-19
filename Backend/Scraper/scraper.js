import pRetry from "p-retry";
import {
    DEFAULT_TIMEOUT,
    RETRYABLE_STATUS,
    SCRAPER_RETRIES,
    SWEEP_DELAY_MS,
    SWEEP_MAX_REQUESTS,
    SWEEP_PROBE_GAP,
    USER_AGENT,
} from "./constants.js";
import { fetchCatalogPage } from "./catalog.js";
import { parsePage } from "./parser.js";
import { ProductNotFoundError, fetchProduct } from "./product.js";
import { fetchPrice } from "./price.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchPage(url, options = {}) {
    const {
        timeout = DEFAULT_TIMEOUT,
        retries = SCRAPER_RETRIES,
        headers = {},
        signal,
    } = options;

    const requestedUrl = new URL(url).href;

    return pRetry(
        async () => {
            const response = await fetch(requestedUrl, {
                redirect: "follow",
                headers: {
                    "user-agent": USER_AGENT,
                    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
                    ...headers,
                },
                signal: signal
                    ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
                    : AbortSignal.timeout(timeout),
            });

            if (RETRYABLE_STATUS.has(response.status)) {
                throw new Error(`Retryable HTTP ${response.status} for ${requestedUrl}`);
            }

            return {
                requestedUrl,
                finalUrl: response.url || requestedUrl,
                status: response.status,
                ok: response.ok,
                contentType: response.headers.get("content-type") ?? "",
                html: await response.text(),
            };
        },
        {
            retries,
            signal,
            onFailedAttempt: (error) => {
                console.warn(
                    `[scraper] ${requestedUrl} attempt ${error.attemptNumber} failed: ${error.message} (${error.retriesLeft} left)`,
                );
            },
        },
    );
}

export async function scrapePage(url, options = {}) {
    const page = await fetchPage(url, options);

    if (!page.contentType.includes("html")) {
        return { ...page, isHtml: false };
    }

    return { ...page, isHtml: true, ...parsePage(page.html, page.finalUrl) };
}

//store orchestration

export async function scrapeProduct(productId, options = {}) {
    const product = await fetchProduct(productId, options);
    const quote = await fetchPrice(productId, options);
    return { ...product, ...quote };
}

export async function scrapeCatalog(options = {}) {
    const {
        delayMs = SWEEP_DELAY_MS,
        probeGap = SWEEP_PROBE_GAP,
        maxRequests = SWEEP_MAX_REQUESTS,
        startFrom = 1,
        onProgress,
        ...productOptions
    } = options;

    if (!Number.isInteger(startFrom) || startFrom < 1) {
        throw new Error(`Invalid startFrom: ${startFrom}`);
    }

    const bootstrap = await fetchCatalogPage(1, {
        baseUrl: productOptions.baseUrl,
        timeout: productOptions.timeout,
        headers: productOptions.headers,
        signal: productOptions.signal,
        pageSize: 1,
    });

    const products = [];
    const missing = [];
    const failures = [];
    let requests = 0;
    let id = startFrom;
    let limit = bootstrap.total;
    let reach = 0;
    let provenEnd = false;

    const emit = (phase) =>
        onProgress?.({
            phase,
            id,
            requests,
            found: products.length,
            missing: missing.length,
            failures: failures.length,
        });

    const budgetSpent = () => maxRequests !== null && requests >= maxRequests;

    const walkOne = async (target) => {
        requests++;
        try {
            products.push(await fetchProduct(target, productOptions));
            return "found";
        } catch (error) {
            if (error instanceof ProductNotFoundError) {
                missing.push(target);
                return "missing";
            }
            failures.push({ id: target, message: error.message });
            return "failed";
        }
    };

    while (id <= limit && !budgetSpent()) {
        if ((await walkOne(id)) === "found") reach = Math.max(reach, id);
        id++;
        emit("walk");
        if (id <= limit && !budgetSpent() && delayMs > 0) await sleep(delayMs);
    }

    let gap = 0;
    while (!provenEnd && !budgetSpent()) {
        const outcome = await walkOne(id);
        if (outcome === "found") {
            reach = Math.max(reach, id);
            limit = id;
            gap = 0;
            id++;
        } else if (outcome === "missing") {
            gap++;
            id++;
            if (gap >= probeGap) provenEnd = true;
        } else {
            break;
        }
        emit("probe");
        if (!provenEnd && !budgetSpent() && delayMs > 0) await sleep(delayMs);
    }

    return {
        total: bootstrap.total,
        bound: reach,
        walked: requests,
        products,
        missing,
        failures,
        complete: provenEnd && failures.length === 0,
        nextCursor: provenEnd ? null : id,
    };
}

export { parsePage } from "./parser.js";
export default scrapeProduct;
