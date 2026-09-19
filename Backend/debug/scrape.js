#!/usr/bin/env node
/**
 * Debug harness — runs our own lib code against the live store and prints what comes back.
 * No test fixtures, no mocks: this hits the real thing.
 *
 *   node debug/scrape.js catalog [page]        [--pageSize=20] [--json]
 *   node debug/scrape.js collect [maxRequests] [--pageSize=60] [--delay=150] [--json]
 *   node debug/scrape.js product <productId>   [--json]
 *   node debug/scrape.js price <productId>     [--json]
 *   node debug/scrape.js page <url>            [--json]
 *   node debug/scrape.js probe [requests]
 *
 * Base URL comes from STORE_BASE_URL, defaulting to https://demo.inelabteamdev.com/
 */
import {
    CatalogStructureError,
    collectProducts,
    fetchCatalogPage,
} from "../Scraper/catalog.js";
import { PriceChallengeError, PriceStructureError, fetchPrice } from "../Scraper/price.js";
import {
    ProductNotFoundError,
    ProductStructureError,
    fetchProduct,
} from "../Scraper/product.js";
import { scrapeCatalog, scrapePage, scrapeProduct } from "../Scraper/scraper.js";
import { SWEEP_DELAY_MS, SWEEP_MAX_REQUESTS } from "../Scraper/constants.js";

const BASE_URL = process.env.STORE_BASE_URL ?? "https://demo.inelabteamdev.com/";
const LABEL = BASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

function usage() {
    console.log(`PricePulse debug harness — target: ${BASE_URL}

  catalog [page]         fetch one catalog page (default page 1)
  collect [maxRequests]  draw until every product is seen (default 30 requests)
  product <productId>    fetch one product's details (the JSON API, no challenge)
  price <productId>      reveal one product's price (challenge -> session -> quote)
  record <productId>     product details + revealed price in one call (4 requests)
  sweep [startFrom]      walk /api/product/{id} to build the whole catalogue
  page <url>             run the generic scraper+parser over any URL
  probe [requests]       raw transport probe: what does the store actually return?

Flags:
  --pageSize=N   items per request (store caps at 60)
  --delay=N      ms between requests
  --max=N        sweep: request budget before it stops and hands back a cursor
  --json         dump raw JSON instead of a table

Examples:
  node debug/scrape.js catalog 1 --pageSize=5
  node debug/scrape.js collect 60
  node debug/scrape.js product 722
  node debug/scrape.js price 722
  node debug/scrape.js record 722
  node debug/scrape.js sweep 1 --max=50 --delay=120
  node debug/scrape.js page ${BASE_URL}product/463
  node debug/scrape.js probe 30`);
}

const num = (value, fallback) => (value === undefined ? fallback : Number(value));
const clock = () => performance.now();
const secs = (start) => `${((clock() - start) / 1000).toFixed(2)}s`;

function printItems(items) {
    const width = Math.max(4, ...items.map((item) => item.name.length));
    for (const item of items) {
        console.log(`  ${String(item.id).padStart(5)}  ${item.name.padEnd(width)}`);
    }
}

function fail(error) {
    if (error instanceof PriceChallengeError) {
        console.error(`\nREJECTED: ${error.message}`);
        console.error(
            "The store refused the synthetic hover. Re-run for a fresh challenge — the" +
                "\nchallenge and the token are both single shot, so replaying one will not help.",
        );
        process.exitCode = 1;
        return;
    }

    if (error instanceof ProductNotFoundError) {
        console.error(`\nNOT FOUND: ${error.message}`);
        console.error(
            "The ids are a dense integer range, so a 404 is an answer, not a failure —" +
                "\nthis product genuinely does not exist.",
        );
        process.exitCode = 1;
        return;
    }

    const structural =
        error instanceof CatalogStructureError ||
        error instanceof PriceStructureError ||
        error instanceof ProductStructureError;
    console.error(`\n${structural ? "STRUCTURE ERROR" : "ERROR"}: ${error.name}: ${error.message}`);
    if (structural) {
        console.error("The store's payload no longer matches the schema — this needs a code fix.");
    }
    process.exitCode = 1;
}

async function cmdCatalog({ page, pageSize, json }) {
    console.log(`fetchCatalogPage(page=${page}, pageSize=${pageSize}) against ${LABEL}`);
    const start = clock();
    const result = await fetchCatalogPage(page, { baseUrl: BASE_URL, pageSize });

    if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    console.log(
        `\n  total=${result.total}  pages=${result.pages}  pageSize=${result.pageSize}  page=${result.page}` +
            `  returned=${result.items.length}  in ${secs(start)}\n`,
    );
    printItems(result.items);
}

async function cmdCollect({ maxRequests, pageSize, delayMs, json }) {
    console.log(
        `collectProducts(maxRequests=${maxRequests}, pageSize=${pageSize}, delayMs=${delayMs}) against ${LABEL}`,
    );
    console.log("Progress is noisy on purpose — the store rate-limits and shuffles.\n");

    const start = clock();
    const result = await collectProducts({
        baseUrl: BASE_URL,
        pageSize,
        maxRequests,
        delayMs,
        onProgress: ({ requests, failures, collected, total }) => {
            console.log(
                `  [${secs(start).padStart(7)}] request=${String(requests).padStart(3)}` +
                    ` unique=${String(collected).padStart(4)}/${total ?? "?"}` +
                    ` failed=${failures}`,
            );
        },
    });

    console.log(
        `\n  collected=${result.products.length}/${result.total}` +
            `  complete=${result.complete}` +
            `  requests=${result.requests}  failures=${result.failures}` +
            `  in ${secs(start)}`,
    );

    if (!result.complete) {
        console.log(
            "  incomplete: the store reshuffles pages per request, so a bounded run is a sample,\n" +
                "  not a full catalogue. Raise maxRequests to keep drawing.",
        );
    }

    if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    console.log("");
    printItems(result.products.slice(0, 20));
    if (result.products.length > 20) {
        console.log(`  ... and ${result.products.length - 20} more`);
    }
}

async function cmdProduct({ productId, json }) {
    console.log(`fetchProduct(${productId}) against ${LABEL}`);
    console.log("One GET. This is everything the detail page renders except the price.\n");

    const start = clock();
    const product = await fetchProduct(productId, { baseUrl: BASE_URL });

    if (json) {
        console.log(JSON.stringify(product, null, 2));
        return;
    }

    console.log(
        `\n  ${product.name}` +
            `\n  ${product.brand}  ·  ${product.category}  ·  sku ${product.sku}` +
            `\n  slug=${product.slug}  specs=${Object.keys(product.specs).length}` +
            `  reviews=${product.reviews.length}  in ${secs(start)}`,
    );

    console.log(`\n  ${product.description}`);

    console.log("\n  specs:");
    const width = Math.max(...Object.keys(product.specs).map((key) => key.length));
    for (const [key, value] of Object.entries(product.specs)) {
        console.log(`    ${key.padEnd(width)}  ${value}`);
    }

    if (product.reviews.length > 0) {
        console.log("\n  reviews:");
        for (const review of product.reviews) {
            console.log(
                `    ${String(review.rating).padStart(2)}★  ${review.author.padEnd(12)}` +
                    `  ${review.verifiedPurchase ? "verified" : "        "}` +
                    `  ${String(review.helpfulVotes).padStart(4)} helpful  "${review.title}"`,
            );
        }
    }
}

async function cmdPrice({ productId, json }) {
    console.log(`fetchPrice(${productId}) against ${LABEL}`);
    console.log("Three calls: challenge -> session token -> encrypted quote.\n");

    const start = clock();
    const quote = await fetchPrice(productId, { baseUrl: BASE_URL });

    if (json) {
        console.log(JSON.stringify(quote, null, 2));
        return;
    }

    const money = (value) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: quote.currency,
            maximumFractionDigits: 0,
        }).format(value);

    console.log(
        `\n  ${money(quote.price)}` +
            `  mrp ${money(quote.mrp)}` +
            `${quote.sale === null ? "" : `  sale ${money(quote.sale)}`}` +
            `${quote.badgePct === null ? "" : `  -${quote.badgePct}%`}` +
            `\n  stock=${quote.stock}  delivery=${quote.deliveryDays}d` +
            `  rating=${quote.rating} (${quote.ratingCount})` +
            `\n  seller=${JSON.stringify(quote.seller)}  variant=${quote.variant}` +
            `  pending=${quote.pending}  triple=${quote.triple}` +
            `\n  in ${secs(start)}`,
    );
}

async function cmdPage({ url, json }) {
    console.log(`scrapePage(${url}) against ${LABEL}`);
    const start = clock();
    const page = await scrapePage(url);

    if (!page.isHtml) {
        console.log(
            `\n  status=${page.status}  contentType=${page.contentType}  in ${secs(start)}` +
                `\n  not HTML, so the parser was skipped.`,
        );
        return;
    }

    if (json) {
        console.log(JSON.stringify(page, null, 2));
        return;
    }

    console.log(
        `\n  status=${page.status}  isHtml=${page.isHtml}  in ${secs(start)}` +
            `\n  finalUrl=${page.finalUrl}` +
            `\n  title=${JSON.stringify(page.title)}` +
            `\n  description=${JSON.stringify(page.description.slice(0, 100))}` +
            `\n  canonical=${page.canonical}` +
            `\n  lang=${page.lang}` +
            `\n  headings=${page.headings.length}  links=${page.links.length}` +
            `  images=${page.images.length}  text=${page.text.length} chars` +
            `\n  scripts=${page.scripts.length}  clientRendered=${page.clientRendered}` +
            `\n  openGraph=${JSON.stringify(page.openGraph)}`,
    );

    if (page.clientRendered) {
        console.log(
            "\n  clientRendered: the HTML is a shell and the content is built in JS, so the" +
                "\n  zeros above mean nothing was server-rendered - not that the page is empty." +
                "\n  Scraping this URL can never work; hit the JSON API behind it instead." +
                `\n  bundles: ${page.scripts.map((src) => src.split("/").pop()).join(", ") || "(none)"}`,
        );
    }

    if (page.headings.length > 0) {
        console.log("\n  headings:");
        for (const heading of page.headings.slice(0, 10)) {
            console.log(`    h${heading.level}  ${heading.text}`);
        }
    }
}

async function cmdProbe({ requests }) {
    console.log(`raw fetch probe: ${requests} requests to ${LABEL}/api/catalog\n`);
    const tally = new Map();
    const start = clock();

    for (let i = 0; i < requests; i++) {
        const target = `${BASE_URL.replace(/\/$/, "")}/api/catalog?page=1&pageSize=60`;
        let key;
        try {
            const response = await fetch(target, { signal: AbortSignal.timeout(15000) });
            key = String(response.status);
            await response.arrayBuffer();
        } catch (error) {
            key = error.name;
        }

        tally.set(key, (tally.get(key) ?? 0) + 1);
        process.stdout.write(`\r  ${i + 1}/${requests}  ${secs(start)}   `);
    }

    console.log("\n");
    for (const [status, count] of [...tally].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${status.padEnd(12)} ${count}`);
    }
}

async function cmdScrape({ productId, json }) {
    console.log(`scrapeProduct(${productId}) against ${LABEL}`);
    console.log("Four requests: product detail (1) + price handshake (3).\n");

    const start = clock();
    const record = await scrapeProduct(productId, { baseUrl: BASE_URL });

    if (json) {
        console.log(JSON.stringify(record, null, 2));
        return;
    }

    console.log(
        `\n  ${record.name}  ·  ${record.brand}  ·  ${record.category}  ·  sku ${record.sku}` +
            `\n  price=${record.price}  mrp=${record.mrp}  sale=${record.sale}` +
            `  badgePct=${record.badgePct}  stock=${record.stock}  ${record.currency}` +
            `\n  rating=${record.rating} (${record.ratingCount})  seller=${record.seller}` +
            `  delivery=${record.deliveryDays}d  variant=${record.variant}` +
            `\n  specs=${Object.keys(record.specs).length}  reviews=${record.reviews.length}` +
            `  in ${secs(start)}`,
    );
}

async function cmdSweep({ startFrom, maxRequests, delayMs, json }) {
    console.log(`scrapeCatalog(startFrom=${startFrom}, maxRequests=${maxRequests}) against ${LABEL}`);
    console.log("Bootstraps the bound from /api/catalog, then walks /api/product/{id}.\n");

    const start = clock();
    const result = await scrapeCatalog({
        baseUrl: BASE_URL,
        startFrom,
        maxRequests,
        delayMs,
        onProgress: ({ phase, id, requests, found, missing, failures }) => {
            if (phase !== "probe" && requests % 10 !== 0) return;
            console.log(
                `  [${secs(start).padStart(7)}] ${phase.padEnd(5)} id=${String(id).padStart(4)}` +
                    ` req=${String(requests).padStart(4)}` +
                    ` found=${String(found).padStart(4)} missing=${missing} failed=${failures}`,
            );
        },
    });

    console.log(
        `\n  total=${result.total}  bound=${result.bound}  walked=${result.walked}` +
            `  found=${result.products.length}  missing=${result.missing.length}` +
            `  failed=${result.failures.length}  complete=${result.complete}` +
            `  nextCursor=${result.nextCursor}  in ${secs(start)}`,
    );

    if (result.missing.length > 0 && result.missing.length <= 20) {
        console.log(`  missing ids: ${result.missing.join(", ")}`);
    }
    if (result.failures.length > 0) {
        console.log(
            `  failed ids:  ${result.failures.map((failure) => failure.id).join(", ")}` +
                "  (resume with the cursor, or re-fetch these ids)",
        );
    }

    if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    printItems(result.products.slice(0, 20));
    if (result.products.length > 20) {
        console.log(`  ... and ${result.products.length - 20} more`);
    }
}

const [command, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of rest) {
    if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");
        flags[key] = value ?? true;
    } else {
        positional.push(arg);
    }
}

const shared = { json: Boolean(flags.json) };

try {
    switch (command) {
        case "catalog":
            await cmdCatalog({
                ...shared,
                page: num(positional[0], 1),
                pageSize: num(flags.pageSize, 20),
            });
            break;
        case "collect":
            await cmdCollect({
                ...shared,
                maxRequests: num(positional[0], 30),
                pageSize: num(flags.pageSize, 60),
                delayMs: num(flags.delay, 150),
            });
            break;
        case "product":
            if (positional[0] === undefined) {
                console.error("usage: node debug/scrape.js product <productId>");
                process.exitCode = 1;
                break;
            }
            await cmdProduct({ ...shared, productId: num(positional[0]) });
            break;
        case "price":
            if (positional[0] === undefined) {
                console.error("usage: node debug/scrape.js price <productId>");
                process.exitCode = 1;
                break;
            }
            await cmdPrice({ ...shared, productId: num(positional[0]) });
            break;
        case "record":
            if (positional[0] === undefined) {
                console.error("usage: node debug/scrape.js record <productId>");
                process.exitCode = 1;
                break;
            }
            await cmdScrape({ ...shared, productId: num(positional[0]) });
            break;
        case "sweep":
            await cmdSweep({
                ...shared,
                startFrom: num(positional[0], 1),
                maxRequests: num(flags.max, SWEEP_MAX_REQUESTS),
                delayMs: num(flags.delay, SWEEP_DELAY_MS),
            });
            break;
        case "page":
            await cmdPage({ ...shared, url: positional[0] ?? BASE_URL });
            break;
        case "probe":
            await cmdProbe({ requests: num(positional[0], 20) });
            break;
        default:
            usage();
    }
} catch (error) {
    fail(error);
}
