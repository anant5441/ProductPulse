import pRetry from "p-retry";
import { z } from "zod";
import {
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT,
    PRODUCT_RETRIES,
    RETRYABLE_STATUS,
    USER_AGENT,
} from "./constants.js";

//for all product same 9 spec keys, 7 strings and 2 numbers,
export const ProductSpecsSchema = z.record(z.string(), z.union([z.string(), z.number()]));
export const ReviewSchema = z.object({
    id: z.string().min(1),
    author: z.string(),
    rating: z.number(),
    title: z.string(),
    body: z.string(),
    date: z.string(),
    verifiedPurchase: z.boolean(),
    helpfulVotes: z.number(),
});

export const ProductSchema = z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    name: z.string().min(1),
    brand: z.string(),
    category: z.string(),
    sku: z.string(),
    description: z.string(),
    specs: ProductSpecsSchema,
    reviews: z.array(ReviewSchema),
});

export class ProductStructureError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProductStructureError";
    }
}

export class ProductNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProductNotFoundError";
    }
}

export async function fetchProduct(productId, options = {}) {
    const {
        baseUrl = process.env.STORE_BASE_URL ?? DEFAULT_BASE_URL,
        timeout = DEFAULT_TIMEOUT,
        retries = PRODUCT_RETRIES,
        headers = {},
        signal,
    } = options;

    if (!Number.isInteger(productId) || productId < 1)
        throw new Error(`Invalid product id: ${productId}`);

    const url = new URL(`/api/product/${productId}`, baseUrl);

    const response = await pRetry(
        async () => {
            const result = await fetch(url, {
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

            if (RETRYABLE_STATUS.has(result.status))
                throw new Error(`Retryable HTTP ${result.status} for ${url.href}`);

            return { status: result.status, ok: result.ok, text: await result.text() };
        },
        {
            retries,
            signal,
            onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
                console.warn(
                    `[product] ${url.href} attempt ${attemptNumber} failed: ${error.message} (${retriesLeft} left)`,
                );
            },
        },
    );

    if (response.status === 404)
        throw new ProductNotFoundError(`No product ${productId} (HTTP 404 from ${url.pathname})`);

    if (!response.ok)
        throw new Error(`HTTP ${response.status} for ${url.pathname}`);



    try {
        return ProductSchema.parse(JSON.parse(response.text));
    } catch (error) {
        throw new ProductStructureError(
            `Unexpected product payload from ${url.pathname}: ${error.message}`,
        );
    }
}

export default fetchProduct;
