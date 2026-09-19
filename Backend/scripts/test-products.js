import supabase from "../src/config/supabase.js";
import productService from "../src/services/product.service.js";
import trackingService from "../src/services/tracking.service.js";
import historyService from "../src/services/history.service.js";
import { runDueScrapes } from "../Scheduler/index.js";

async function runProductTests() {
    console.log("==========================================");
    console.log("    ProductPulse - Product & DB Testing   ");
    console.log("==========================================");

    let passed = 0;
    let failed = 0;

    const assert = (condition, title, details = "") => {
        if (condition) {
            console.log(`✅ [PASS] ${title} ${details ? "- " + details : ""}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${title} ${details ? "- " + details : ""}`);
            failed++;
        }
    };

    try {
        // Test 1: Verify products exist in Supabase
        const { count: productCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true });

        assert(productCount > 0, "Products in Supabase", `Total rows: ${productCount}`);

        // Test 2: Search products by keyword
        const searchResults = await productService.searchProducts("Microphone");
        assert(searchResults.length > 0, "Search Products ('Microphone')", `Found: ${searchResults.length}`);

        // Test 3: Get single product by ID or external ID
        const sampleProduct = searchResults[0];
        const detailed = await productService.getProductById(sampleProduct.id);
        assert(detailed && detailed.product && detailed.product.name, "Get Product by ID", `Name: "${detailed?.product?.name}", SKU: ${detailed?.product?.sku}`);

        // Test 4: Track product
        const tracked = await trackingService.trackProduct(sampleProduct.id, 120);
        assert(tracked && tracked.id, "Track Product in DB", `Tracked ID: ${tracked.id}`);

        // Test 5: List tracked products
        const trackedList = await trackingService.listTrackedProducts();
        const isTracked = trackedList.some((t) => t.trackingId === tracked.id);
        assert(isTracked, "List Tracked Products", `Active tracked count: ${trackedList.length}`);

        // Test 6: Run scheduler force scrape
        console.log("\n--- Running Scheduler Force Scrape on Tracked Product ---");
        const schedSummary = await runDueScrapes({ force: true });
        assert(schedSummary.succeeded > 0, "Scheduler Scraped Successfully", `Succeeded: ${schedSummary.succeeded}, Details: ₹${schedSummary.details[0]?.price}`);

        // Test 7: Verify Price History row inserted
        const history = await historyService.getProductHistory(tracked.id, { limit: 5 });
        assert(history.length > 0, "Price History Stored in Supabase", `Observations: ${history.length}, Latest Price: ₹${history[0]?.price}, Stock: ${history[0]?.stock}`);

        // Test 8: Verify Scrape Attempt Log
        const logs = await historyService.getScrapeLogs(tracked.id);
        assert(logs.length > 0, "Scrape Attempt Logged in Supabase", `Total logs: ${logs.length}, Last Status: ${logs[0]?.status}`);

        console.log("\n==========================================");
        console.log(`TEST RESULTS: Passed: ${passed} | Failed: ${failed}`);
        console.log("==========================================");

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error("\n[Fatal Error during Product Test]:", err);
        process.exit(1);
    }
}

runProductTests();
