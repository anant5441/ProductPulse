import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.API_URL || "http://localhost:5000";
const CRON_SECRET = process.env.CRON_SECRET || "productpulse-cron-secret-key";

console.log("=================================================");
console.log("       ProductPulse API Comprehensive Test       ");
console.log(`  Target URL : ${BASE_URL}`);
console.log("=================================================\n");

let passed = 0;
let failed = 0;
let trackedProductId = null;
let testProductDbId = null;

function logPass(title, detail = "") {
    passed++;
    console.log(`✅ [PASS] ${title} ${detail ? "- " + detail : ""}`);
}

function logFail(title, error = "") {
    failed++;
    console.error(`❌ [FAIL] ${title} ${error ? "\n   Error: " + error : ""}`);
}

function logInfo(text) {
    console.log(`ℹ️  ${text}`);
}

async function runTests() {
    // 1. Health Check
    try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const json = await res.json();
        if (res.status === 200 && json.success && json.data.status === "ok") {
            logPass("Health Check (GET /api/health)", `status=${json.data.status}`);
        } else {
            logFail("Health Check (GET /api/health)", JSON.stringify(json));
        }
    } catch (e) {
        logFail("Health Check (GET /api/health)", e.message);
        console.error("\nMake sure the backend server is running with: npm run dev\n");
        process.exit(1);
    }

    // 2. Product Search
    try {
        const res = await fetch(`${BASE_URL}/api/products/search?q=Domus`);
        const json = await res.json();
        if (res.status === 200 && json.success && Array.isArray(json.data.products) && json.data.products.length > 0) {
            const first = json.data.products[0];
            testProductDbId = first.id;
            logPass("Product Search (GET /api/products/search?q=Domus)", `Found ${json.data.products.length} products (Sample: "${first.name}")`);
        } else {
            logFail("Product Search", JSON.stringify(json));
        }
    } catch (e) {
        logFail("Product Search", e.message);
    }

    // 3. Get Product Details by ID / External ID
    try {
        const res = await fetch(`${BASE_URL}/api/products/291`);
        const json = await res.json();
        if (res.status === 200 && json.success && json.data.product) {
            if (!testProductDbId) testProductDbId = json.data.product.id;
            logPass("Get Product by ID (GET /api/products/291)", `Product: "${json.data.product.name}", SKU: ${json.data.product.sku}`);
        } else {
            logFail("Get Product by ID", JSON.stringify(json));
        }
    } catch (e) {
        logFail("Get Product by ID", e.message);
    }

    // 4. Track Product
    if (testProductDbId) {
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: testProductDbId, scrapeIntervalMinutes: 120 }),
            });
            const json = await res.json();
            if ((res.status === 200 || res.status === 201) && json.success && json.data.trackedProduct) {
                trackedProductId = json.data.trackedProduct.id;
                logPass("Track Product (POST /api/tracked-products)", `Tracking ID: ${trackedProductId}`);
            } else {
                logFail("Track Product", json.error?.message || JSON.stringify(json));
            }
        } catch (e) {
            logFail("Track Product", e.message);
        }

        // 5. Duplicate Tracking Prevention Check
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: testProductDbId }),
            });
            const json = await res.json();
            if ((res.status === 200 || res.status === 201) && json.success && json.data.trackedProduct?.id === trackedProductId) {
                logPass("Duplicate Tracking Prevention", `Reused existing tracker ${trackedProductId} without creating duplicate`);
            } else {
                logFail("Duplicate Tracking Prevention", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Duplicate Tracking Prevention", e.message);
        }
    }

    // 6. List Tracked Products
    try {
        const res = await fetch(`${BASE_URL}/api/tracked-products`);
        const json = await res.json();
        if (res.status === 200 && json.success && Array.isArray(json.data.trackedProducts)) {
            logPass("List Tracked Products (GET /api/tracked-products)", `Active trackers: ${json.data.trackedProducts.length}`);
            if (!trackedProductId && json.data.trackedProducts.length > 0) {
                trackedProductId = json.data.trackedProducts[0].trackingId;
            }
        } else {
            logFail("List Tracked Products", JSON.stringify(json));
        }
    } catch (e) {
        logFail("List Tracked Products", e.message);
    }

    // 7. Manual Scrape Execution
    if (trackedProductId) {
        logInfo(`Running manual scrape on tracked product ${trackedProductId}... (Handshake, Wasm, Decrypt)`);
        try {
            const res = await fetch(`${BASE_URL}/api/scrape/product/${trackedProductId}`, {
                method: "POST",
            });
            const json = await res.json();
            if (res.status === 200 && json.success) {
                logPass("Manual Scrape (POST /api/scrape/product/:id)", `Price: ₹${json.data.price}, StockStatus: ${json.data.stockStatus}, Attempts: ${json.data.attempts}`);
            } else {
                logFail("Manual Scrape", json.error?.message || JSON.stringify(json));
            }
        } catch (e) {
            logFail("Manual Scrape", e.message);
        }

        // 8. Price History
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products/${trackedProductId}/history`);
            const json = await res.json();
            if (res.status === 200 && json.success && Array.isArray(json.data.history)) {
                logPass("Price History (GET /api/tracked-products/:id/history)", `Observations: ${json.data.history.length}`);
            } else {
                logFail("Price History", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Price History", e.message);
        }

        // 9. Chart-friendly Price History
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products/${trackedProductId}/price-history`);
            const json = await res.json();
            if (res.status === 200 && Array.isArray(json)) {
                logPass("Price Chart API (GET /api/tracked-products/:id/price-history)", `Data points: ${json.length}`);
            } else {
                logFail("Price Chart API", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Price Chart API", e.message);
        }

        // 10. Stock History
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products/${trackedProductId}/stock-history`);
            const json = await res.json();
            if (res.status === 200 && Array.isArray(json)) {
                logPass("Stock History API (GET /api/tracked-products/:id/stock-history)", `Entries: ${json.length}`);
            } else {
                logFail("Stock History API", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Stock History API", e.message);
        }

        // 11. Scrape Attempt Logs
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products/${trackedProductId}/scrape-logs`);
            const json = await res.json();
            if (res.status === 200 && json.success && Array.isArray(json.data.logs)) {
                logPass("Scrape Logs API (GET /api/tracked-products/:id/scrape-logs)", `Logged attempts: ${json.data.logs.length}`);
            } else {
                logFail("Scrape Logs API", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Scrape Logs API", e.message);
        }

        // 12. Tracking Status Summary
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products/${trackedProductId}/status`);
            const json = await res.json();
            if (res.status === 200 && json.success && json.data.status) {
                logPass("Tracking Status API (GET /api/tracked-products/:id/status)", `Status: ${json.data.status}, LatestPrice: ₹${json.data.latestPrice}`);
            } else {
                logFail("Tracking Status API", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Tracking Status API", e.message);
        }
    }

    // 13. Cron Authentication Rejection (Unauthorized request)
    try {
        const res = await fetch(`${BASE_URL}/api/cron/scrape`, { method: "POST" });
        const json = await res.json();
        if (res.status === 401 && !json.success) {
            logPass("Cron Auth Security (Reject missing secret with 401)", "Correctly blocked unauthorized call");
        } else {
            logFail("Cron Auth Security", `Expected 401, got ${res.status}`);
        }
    } catch (e) {
        logFail("Cron Auth Security", e.message);
    }

    // 14. Cron Authorized Execution
    try {
        const res = await fetch(`${BASE_URL}/api/cron/scrape`, {
            method: "POST",
            headers: { "x-cron-secret": CRON_SECRET },
        });
        const json = await res.json();
        if (res.status === 200 && json.success) {
            logPass("Cron Authorized Trigger (POST /api/cron/scrape)", `Scraped: ${json.data.scraped}, Due: ${json.data.totalDue}`);
        } else {
            logFail("Cron Authorized Trigger", json.error?.message || JSON.stringify(json));
        }
    } catch (e) {
        logFail("Cron Authorized Trigger", e.message);
    }

    // 15. Untrack Product
    if (trackedProductId) {
        try {
            const res = await fetch(`${BASE_URL}/api/tracked-products/${trackedProductId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (res.status === 200 && json.success && json.data.trackedProduct?.is_active === false) {
                logPass("Untrack Product (DELETE /api/tracked-products/:id)", "Deactivated tracking while preserving history");
            } else {
                logFail("Untrack Product", JSON.stringify(json));
            }
        } catch (e) {
            logFail("Untrack Product", e.message);
        }
    }

    console.log("\n=================================================");
    console.log(`                TEST RESULTS                     `);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log("=================================================");

    if (failed > 0) {
        console.log("\n💡 Note: If tests failed with 'permission denied for table', make sure your");
        console.log("   SUPABASE_SERVICE_ROLE_KEY is set in Backend/.env\n");
    }
}

runTests();
