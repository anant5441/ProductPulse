// const { chromium } = require("playwright");

// (async () => {
//     const browser = await chromium.launch({
//         headless: false
//     });

//     const page = await browser.newPage({
//         viewport: {
//             width: 1280,
//             height: 800
//         }
//     });

//     console.log("Opening product...");

//     await page.goto("https://demo.inelabteamdev.com/product/291", {
//         waitUntil: "domcontentloaded"
//     });

//     console.log("Product page opened");

//     await page.waitForTimeout(3000);

//     const revealButton = page.getByRole("button", {
//         name: /reveal price/i
//     });

//     console.log("Looking for Reveal Price button...");

//     await revealButton.waitFor({
//         state: "visible",
//         timeout: 10000
//     });

//     console.log("Reveal Price button found");

//     await revealButton.click();

//     console.log("Reveal Price clicked");

//     await page.waitForTimeout(10000);

//     console.log("========== PAGE DATA ==========");

//     const bodyText = await page.locator("body").innerText();

//     console.log(bodyText);

//     console.log("================================");

// })();

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "https://demo.inelabteamdev.com";

// Change this while testing different products.
const PRODUCT_URL =
    "https://demo.inelabteamdev.com/product/291";

const MAX_ATTEMPTS = 3;
const NAVIGATION_TIMEOUT = 30000;
const PRICE_REVEAL_TIMEOUT = 20000;
const BROWSER_HEADLESS = false;


/* =========================================================
   Utility Functions
========================================================= */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function cleanText(value) {
    if (!value) return "";

    return value
        // Remove zero-width Unicode characters.
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        // Normalize whitespace.
        .replace(/\s+/g, " ")
        .trim();
}


function parsePrice(value) {
    const cleaned = cleanText(value);

    /*
      Handles:

      ₹15,703
      ₹ 15,703
      Rs. 15,703
      15,703
    */

    const match = cleaned.match(
        /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i
    );

    if (!match) {
        return null;
    }

    const number = Number(
        match[1].replace(/,/g, "")
    );

    return Number.isFinite(number)
        ? number
        : null;
}


function parseDiscount(value) {
    const cleaned = cleanText(value);

    const match = cleaned.match(/(\d+(?:\.\d+)?)\s*%\s*off/i);

    if (!match) {
        return null;
    }

    return Number(match[1]);
}


function parseStock(value) {
    const cleaned = cleanText(value);

    if (/out\s+of\s+stock/i.test(cleaned)) {
        return {
            status: "out_of_stock",
            quantity: null
        };
    }

    const match = cleaned.match(
        /(\d[\d,]*)\s*(?:in\s+stock|available)/i
    );

    if (match) {
        return {
            status: "in_stock",
            quantity: Number(
                match[1].replace(/,/g, "")
            )
        };
    }

    if (/in\s+stock/i.test(cleaned)) {
        return {
            status: "in_stock",
            quantity: null
        };
    }

    return {
        status: "unknown",
        quantity: null
    };
}


function parseRatings(value) {
    const cleaned = cleanText(value);

    const match = cleaned.match(
        /([\d,.]+[kKmM]?)\s*ratings?/i
    );

    if (!match) {
        return null;
    }

    return match[1];
}


/* =========================================================
   DOM Helpers
========================================================= */

async function getVisibleText(page) {
    return cleanText(
        await page.locator("body").innerText()
    );
}


/*
   Get text from elements containing a particular
   piece of text.

   This is useful when the site's class names change.
*/
async function findTextContaining(page, pattern) {

    const result = await page.locator("body *").evaluateAll(
        (elements, pattern) => {

            const matches = [];

            for (const element of elements) {

                const text = element.innerText?.trim();

                if (!text) continue;

                if (text.toLowerCase().includes(pattern.toLowerCase())) {

                    matches.push({
                        tag: element.tagName,
                        id: element.id || null,
                        className:
                            typeof element.className === "string"
                                ? element.className
                                : null,
                        text
                    });
                }
            }

            /*
              Prefer smaller elements.

              The body contains everything, so we don't
              want the largest parent element.
            */
            return matches
                .sort((a, b) =>
                    a.text.length - b.text.length
                )
                .slice(0, 10);
        },
        pattern
    );

    return result;
}


/* =========================================================
   Product Parser
========================================================= */

async function parseProduct(page) {

    const bodyText = await page.locator("body").innerText();

    const text = cleanText(bodyText);

    /*
      -------------------------------------------------------
      PRODUCT NAME
      -------------------------------------------------------
    */

    let name = null;

    /*
      Look for the product heading.

      We first try common semantic heading elements.
    */

    const headings = await page.locator(
        "h1, h2, h3"
    ).allTextContents();

    const cleanedHeadings = headings
        .map(cleanText)
        .filter(Boolean);

    /*
      Ignore generic page headings.
    */

    const ignoredHeadings = [
        "INE Store",
        "Specifications",
        "Warranty",
        "In the box",
        "About this item",
        "Customer reviews"
    ];

    name = cleanedHeadings.find(
        heading =>
            !ignoredHeadings.includes(heading) &&
            !/back to products/i.test(heading) &&
            heading.length > 3
    ) || null;


    /*
      -------------------------------------------------------
      SKU
      -------------------------------------------------------
    */

    let sku = null;

    const skuMatch = text.match(
        /SKU\s+([A-Z0-9_-]+)/i
    );

    if (skuMatch) {
        sku = cleanText(skuMatch[1]);
    }


    /*
      -------------------------------------------------------
      BRAND
      -------------------------------------------------------
    */

    let brand = null;

    /*
      Example visible structure:

      Domus · SKU DOM-10291
    */

    const brandMatch = text.match(
        /([A-Za-z0-9&.' -]+)\s*[·•]\s*SKU\s+[A-Z0-9_-]+/i
    );

    if (brandMatch) {
        brand = cleanText(brandMatch[1]);
    }


    /*
      -------------------------------------------------------
      PRICES
      -------------------------------------------------------
    */

    const priceCandidates = [];

    /*
      Search all visible text nodes for currency values.
    */

    const currencyMatches = text.match(
        /(?:₹|Rs\.?|INR)\s*[\d,\u200B-\u200D\uFEFF]+(?:\.\d+)?/gi
    ) || [];

    for (const value of currencyMatches) {

        const price = parsePrice(value);

        if (
            price !== null &&
            !priceCandidates.includes(price)
        ) {
            priceCandidates.push(price);
        }
    }


    /*
      Based on the storefront output:

      ₹23,792
      ₹15,703

      The first is original price.
      The second is current price.

      We therefore require at least one price.
    */

    const originalPrice =
        priceCandidates.length >= 2
            ? priceCandidates[0]
            : null;

    const currentPrice =
        priceCandidates.length >= 2
            ? priceCandidates[1]
            : priceCandidates[0] ?? null;


    /*
      -------------------------------------------------------
      DISCOUNT
      -------------------------------------------------------
    */

    const discountMatch = text.match(
        /(\d+(?:\.\d+)?)\s*%\s*off/i
    );

    const discount = discountMatch
        ? Number(discountMatch[1])
        : null;


    /*
      -------------------------------------------------------
      STOCK
      -------------------------------------------------------
    */

    let stockStatus = "unknown";
    let stockQuantity = null;

    const stockMatch = text.match(
        /(?:OUT\s+OF\s+STOCK|\d[\d,]*\s+IN\s+STOCK|IN\s+STOCK)/i
    );

    if (stockMatch) {

        const stock = parseStock(
            stockMatch[0]
        );

        stockStatus = stock.status;
        stockQuantity = stock.quantity;
    }


    /*
      -------------------------------------------------------
      DELIVERY
      -------------------------------------------------------
    */

    let delivery = null;

    const deliveryMatch = text.match(
        /Get it by\s+([^\n]+)/i
    );

    if (deliveryMatch) {
        delivery = cleanText(
            deliveryMatch[1]
        );
    }


    /*
      -------------------------------------------------------
      RATINGS
      -------------------------------------------------------
    */

    const ratingsMatch = text.match(
        /([\d,.]+[kKmM]?)\s*ratings?/i
    );

    const ratings = ratingsMatch
        ? ratingsMatch[1]
        : null;


    /*
      -------------------------------------------------------
      SELLER
      -------------------------------------------------------
    */

    let seller = null;

    const sellerMatch = text.match(
        /Sold by\s+([^\n]+)/i
    );

    if (sellerMatch) {
        seller = cleanText(
            sellerMatch[1]
        );
    }


    /*
      -------------------------------------------------------
      DESCRIPTION
      -------------------------------------------------------
    */

    let description = null;

    const aboutIndex =
        text.indexOf("About this item");

    if (aboutIndex !== -1) {

        const afterAbout =
            text.substring(
                aboutIndex + "About this item".length
            );

        const reviewsIndex =
            afterAbout.indexOf("Customer reviews");

        if (reviewsIndex !== -1) {

            description = cleanText(
                afterAbout.substring(
                    0,
                    reviewsIndex
                )
            );
        }
    }


    /*
      -------------------------------------------------------
      RETURN
      -------------------------------------------------------
    */

    return {

        url: page.url(),

        name,

        brand,

        sku,

        originalPrice,

        currentPrice,

        discount,

        stockStatus,

        stockQuantity,

        delivery,

        ratings,

        seller,

        description,

        scrapedAt:
            new Date().toISOString()
    };
}


/* =========================================================
   Validation
========================================================= */

function validateProduct(product) {

    const errors = [];

    if (!product.name) {
        errors.push(
            "Product name could not be extracted"
        );
    }

    if (!product.sku) {
        errors.push(
            "SKU could not be extracted"
        );
    }

    if (
        product.currentPrice === null ||
        product.currentPrice <= 0
    ) {
        errors.push(
            "Current price is missing or invalid"
        );
    }

    if (!product.stockStatus) {
        errors.push(
            "Stock status is missing"
        );
    }

    /*
      If original price exists, it should not normally
      be lower than current price.
    */

    if (
        product.originalPrice !== null &&
        product.currentPrice !== null &&
        product.originalPrice < product.currentPrice
    ) {
        errors.push(
            "Original price is lower than current price"
        );
    }

    return errors;
}


/* =========================================================
   Scrape One Product
========================================================= */

async function scrapeProduct(page, url) {

    console.log(
        `Opening: ${url}`
    );

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT
    });

    console.log(
        "Product page loaded"
    );


    /*
      Give React / other asynchronous application
      code time to initialize.
    */

    await page.waitForTimeout(2000);


    /*
      -------------------------------------------------------
      Find Reveal Price
      -------------------------------------------------------
    */

    const revealButton = page.getByRole(
        "button",
        {
            name: /reveal price/i
        }
    );


    await revealButton.waitFor({
        state: "visible",
        timeout: 15000
    });

    console.log(
        "Reveal Price button found"
    );


    /*
      -------------------------------------------------------
      Click
      -------------------------------------------------------
    */

    await revealButton.click();

    console.log(
        "Reveal Price clicked"
    );


    /*
      -------------------------------------------------------
      Wait for price to actually appear
      -------------------------------------------------------
    */

    await page.waitForFunction(() => {

        const body =
            document.body.innerText || "";

        return (
            /₹\s*[\d,]+/.test(body) &&
            !/REVEAL PRICE/i.test(body)
        );

    }, {
        timeout: PRICE_REVEAL_TIMEOUT
    });


    console.log(
        "Price appears to be revealed"
    );


    /*
      Small stabilization delay.

      This helps when multiple fields are rendered
      asynchronously.
    */

    await page.waitForTimeout(1000);


    /*
      -------------------------------------------------------
      Parse
      -------------------------------------------------------
    */

    const product =
        await parseProduct(page);


    /*
      -------------------------------------------------------
      Validate
      -------------------------------------------------------
    */

    const validationErrors =
        validateProduct(product);


    if (validationErrors.length > 0) {

        throw new Error(
            "Validation failed:\n" +
            validationErrors
                .map(error => `- ${error}`)
                .join("\n")
        );
    }


    return product;
}


/* =========================================================
   Retry System
========================================================= */

async function scrapeWithRetry(
    page,
    url,
    maxAttempts = MAX_ATTEMPTS
) {

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        console.log(
            `\n========== ATTEMPT ${attempt}/${maxAttempts} ==========`
        );

        try {

            const result =
                await scrapeProduct(
                    page,
                    url
                );

            console.log(
                `Attempt ${attempt}: SUCCESS`
            );

            return {
                success: true,
                attempts: attempt,
                product: result
            };

        } catch (error) {

            lastError = error;

            console.error(
                `Attempt ${attempt}: FAILED`
            );

            console.error(
                error.message
            );


            /*
              Save screenshot for debugging.
            */

            try {

                const screenshotPath =
                    path.join(
                        __dirname,
                        `failed-attempt-${attempt}.png`
                    );

                await page.screenshot({
                    path: screenshotPath,
                    fullPage: true
                });

                console.log(
                    `Screenshot saved: ${screenshotPath}`
                );

            } catch {
                console.log(
                    "Could not save screenshot"
                );
            }


            /*
              Don't wait after final attempt.
            */

            if (
                attempt < maxAttempts
            ) {

                /*
                  Exponential backoff:

                  attempt 1 → 2 sec
                  attempt 2 → 4 sec
                */

                const delay =
                    2000 * Math.pow(
                        2,
                        attempt - 1
                    );

                console.log(
                    `Retrying after ${delay} ms...`
                );

                await sleep(delay);
            }
        }
    }


    return {
        success: false,
        attempts: maxAttempts,
        error:
            lastError
                ? lastError.message
                : "Unknown scraping error"
    };
}


/* =========================================================
   Main
========================================================= */

async function main() {

    console.log(
        "=========================================="
    );

    console.log(
        "        ProductPulse Scraper"
    );

    console.log(
        "=========================================="
    );


    const browser =
        await chromium.launch({
            headless: BROWSER_HEADLESS
        });


    const context =
        await browser.newContext({
            viewport: {
                width: 1280,
                height: 800
            }
        });


    const page =
        await context.newPage();


    /*
      -------------------------------------------------------
      Logging API requests
      -------------------------------------------------------
    */

    page.on(
        "request",
        request => {

            if (
                request.url().includes("/api/")
            ) {

                console.log(
                    `API REQUEST: ${request.method()} ${request.url()}`
                );
            }
        }
    );


    page.on(
        "response",
        response => {

            if (
                response.url().includes("/api/")
            ) {

                console.log(
                    `API RESPONSE: ${response.status()} ${response.url()}`
                );
            }
        }
    );


    /*
      -------------------------------------------------------
      Run scraper
      -------------------------------------------------------
    */

    const result =
        await scrapeWithRetry(
            page,
            PRODUCT_URL
        );


    /*
      -------------------------------------------------------
      Output
      -------------------------------------------------------
    */

    console.log(
        "\n=========================================="
    );

    console.log(
        "FINAL RESULT"
    );

    console.log(
        "=========================================="
    );


    if (result.success) {

        console.log(
            JSON.stringify(
                result.product,
                null,
                2
            )
        );


        /*
          Save JSON
        */

        const outputPath =
            path.join(
                __dirname,
                "scraped-product.json"
            );


        fs.writeFileSync(
            outputPath,
            JSON.stringify(
                result.product,
                null,
                2
            )
        );


        console.log(
            `\nSaved to: ${outputPath}`
        );

    } else {

        console.error(
            `SCRAPE FAILED after ${result.attempts} attempts`
        );

        console.error(
            result.error
        );
    }


    /*
      Keep browser open while developing.

      Remove this before deploying.
    */

    if (!BROWSER_HEADLESS) {

        console.log(
            "\nBrowser will remain open for 15 seconds..."
        );

        await sleep(15000);
    }


    await browser.close();
}


/* =========================================================
   Start
========================================================= */

main().catch(error => {

    console.error(
        "\nFATAL ERROR:"
    );

    console.error(
        error
    );

    process.exit(1);
});