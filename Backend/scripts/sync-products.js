import productService from "../src/services/product.service.js";
import supabase from "../src/config/supabase.js";

async function main() {
    console.log("==========================================");
    console.log("   ProductPulse - Sync All Products to DB ");
    console.log("==========================================");

    const started = Date.now();
    try {
        const { count: initialCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true });

        console.log(`Initial products in Supabase: ${initialCount || 0}`);
        console.log("Syncing from catalog/all_products.json...");

        const result = await productService.syncAllProducts(50);

        const { count: finalCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true });

        const durationSec = ((Date.now() - started) / 1000).toFixed(2);
        console.log("\n--- Sync Summary ---");
        console.log(`Total Products in Catalog : ${result.totalProducts}`);
        console.log(`Successfully Synced       : ${result.syncedCount}`);
        console.log(`Failures                  : ${result.failedCount}`);
        console.log(`Final Supabase DB Count   : ${finalCount}`);
        console.log(`Time Elapsed              : ${durationSec}s`);
        console.log("==========================================");

        process.exit(result.failedCount > 0 && result.syncedCount === 0 ? 1 : 0);
    } catch (err) {
        console.error("\n[Fatal] Product sync failed:", err.message);
        process.exit(1);
    }
}

main();
