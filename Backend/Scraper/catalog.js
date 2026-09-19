import pRetry, { AbortError } from "p-retry";
import { z } from "zod";
import {
    CATALOG_RETRIES,
    DEFAULT_BASE_URL,
    DEFAULT_COLLECT_DELAY_MS,
    DEFAULT_COLLECT_REQUESTS,
    DEFAULT_PAGE_SIZE,
    DEFAULT_TIMEOUT,
    MAX_PAGE_SIZE,
    RETRYABLE_STATUS,
    USER_AGENT,
} from "./constants.js";

export const CatalogProductSchema = z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    name: z.string().min(1),
    brand: z.string(),
    category: z.string(),
    sku: z.string(),
    description: z.string(),
});

export const CatalogPageSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    items: z.array(CatalogProductSchema),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ultimate error that we can't reolve so we jst drop it
export class CatalogStructureError extends Error {
    constructor(message) {
        super(message);
        this.name = "CatalogStructureError";
    }
}

export function catalogUrl(baseUrl, page, pageSize) {
    const url = new URL("/api/catalog", baseUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(Math.min(pageSize, MAX_PAGE_SIZE)));//this is the max page size 60 the server enforced limit
    return url;
}

//fetching the catalog is a gamble cause the products on catalog page gets shuffled on every req
export async function fetchCatalogPage(page = 1, options = {}) {
    const {
        pageSize = DEFAULT_PAGE_SIZE,
        baseUrl = process.env.STORE_BASE_URL ?? DEFAULT_BASE_URL,
        timeout = DEFAULT_TIMEOUT,
        retries = CATALOG_RETRIES,
        headers = {},
        signal,
    } = options;

    if (!Number.isInteger(page) || page < 1) {
        throw new Error(`Invalid catalog page: ${page}`);
    }

    const url = catalogUrl(baseUrl, page, pageSize);

    //the retry mechnism cause we got 502s on every daam 5th req
    const body = await pRetry(
        async () => {
            const response = await fetch(url, {
                redirect: "follow",
                headers: {
                    "user-agent": USER_AGENT,
                    accept: "application/json",
                    ...headers,
                },
                signal: signal
                    ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
                    : AbortSignal.timeout(timeout),
            });

            if (RETRYABLE_STATUS.has(response.status))
                throw new Error(`Retryable HTTP ${response.status} for ${url.href}`);

            if (!response.ok)
                throw new AbortError(`HTTP ${response.status} for ${url.href}`);


            return response.text();
        },
        {
            retries,
            signal,
            onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
                console.warn(
                    `[catalog] ${url.href} attempt ${attemptNumber} failed: ${error.message} (${retriesLeft} left)`,
                );
            },
        },
    );

    //parseing the struture outside else ptry will mix things up
    try {
        return CatalogPageSchema.parse(JSON.parse(body));
    } catch (error) {
        throw new CatalogStructureError(
            `Unexpected catalog payload from ${url.href}: ${error.message}`,
        );
    }
}

// ok simple idea we fetch all the pages to get all the products
// Correction : it won't work cause the page is shuffling and i never got more than 960 products outa 1000 sothis fn is not anymorein use still its jst here for idk why
export async function collectProducts(options = {}) {
    const {
        pageSize = MAX_PAGE_SIZE,
        maxRequests = DEFAULT_COLLECT_REQUESTS,
        delayMs = DEFAULT_COLLECT_DELAY_MS,
        onProgress,
        ...pageOptions
    } = options;

    const products = new Map();
    let total = null;
    let pages = 1;
    let requests = 0;
    let failures = 0;

    while (requests < maxRequests && (total === null || products.size < total)) {
        const page = (requests % pages) + 1;
        requests++;

        try {
            const response = await fetchCatalogPage(page, { ...pageOptions, pageSize });
            total = response.total;
            pages = Math.max(response.pages, 1);
            for (const product of response.items) {
                products.set(product.id, product);
            }
        } catch (error) {
            if (error instanceof CatalogStructureError) throw error;
            failures++;
        }

        onProgress?.({ requests, failures, collected: products.size, total });

        if (delayMs > 0 && requests < maxRequests && (total === null || products.size < total)) {
            await sleep(delayMs);
        }
    }

    return {
        total,
        complete: total !== null && products.size >= total,
        requests,
        failures,
        products: [...products.values()],
    };
}

export default fetchCatalogPage;
