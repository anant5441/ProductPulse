import { listIds, upsertDetail, upsertIdentity } from "../Models/products.js";
import { collectProducts } from "./catalog.js";
import { DEFAULT_COLLECT_DELAY_MS, FILL_BATCH_SIZE, MAX_PAGE_SIZE } from "./constants.js";
import { ProductNotFoundError, fetchProduct } from "./product.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeIdentity(rows, batchSize) {
    let written = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
        written += await upsertIdentity(rows.slice(i, i + batchSize));
    }
    return written;
}

// Fill the `products` table in two passes (session3.md §4).
//
// Pass 1 draws catalog pages — 60 items per request, so most of the catalog's identity lands
// cheaply. Pass 2 covers the gap: the ids are dense, so `[1..total] - seen` is just a range
// difference, and each missing id is fetched independently. That makes it resumable (a 429
// costs one id, not the run) and lets a `404` prove absence rather than silently drop a row.
//
// All-or-nothing per cycle is not needed here: rows upsert on `id`, so a partial run is a
// valid partial fill and re-running converges.
export async function fillCatalog(options = {}) {
    const {
        pageSize = MAX_PAGE_SIZE,
        maxCatalogRequests = 40,
        maxProductRequests = 100,
        delayMs = DEFAULT_COLLECT_DELAY_MS,
        startFrom = 1,
        batchSize = FILL_BATCH_SIZE,
        onProgress,
        ...storeOptions
    } = options;

    // pass 1 — cheap identity
    const sampled = await collectProducts({
        ...storeOptions,
        pageSize,
        maxRequests: maxCatalogRequests,
        delayMs,
    });
    const identityWritten = await writeIdentity(sampled.products, batchSize);

    onProgress?.({
        phase: "identity",
        requests: sampled.requests,
        sampled: sampled.products.length,
        total: sampled.total,
        written: identityWritten,
    });

    // pass 2 — backfill the dense-id gaps via the product API. The gap is the range minus
    // what the table already holds, not just this run's sample, so a re-run resumes instead
    // of re-fetching products already stored.
    const total = sampled.total;
    const known = new Set(await listIds());
    const missing = [];
    if (total !== null) {
        for (let id = startFrom; id <= total; id++) {
            if (!known.has(id)) missing.push(id);
        }
    }

    const failures = [];
    let backfilled = 0;
    let requests = 0;

    for (const id of missing) {
        if (requests >= maxProductRequests) break;
        requests++;

        try {
            await upsertDetail(await fetchProduct(id, storeOptions));
            backfilled++;
        } catch (error) {
            // a 404 is proof the id does not exist — an answer, not a failure
            if (!(error instanceof ProductNotFoundError)) {
                failures.push({ id, message: error.message });
            }
        }

        onProgress?.({
            phase: "backfill",
            id,
            requests,
            remaining: missing.length - requests,
            filled: backfilled,
            failures: failures.length,
        });

        if (delayMs > 0 && requests < maxProductRequests) await sleep(delayMs);
    }

    return {
        total,
        sampled: sampled.products.length,
        catalogRequests: sampled.requests,
        catalogFailures: sampled.failures,
        identityWritten,
        gaps: missing.length,
        backfilled,
        productRequests: requests,
        failures,
        // the next gap to process when the product budget runs out; null when nothing is left
        nextCursor: requests < missing.length ? missing[requests] : null,
        complete: total !== null && requests >= missing.length && failures.length === 0,
    };
}

export default fillCatalog;
