import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import ENV from "./env.js";

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[WARNING] Supabase credentials (SUPABASE_URL and key) are not fully configured in environment.");
}

export const supabase = createClient(
    ENV.SUPABASE_URL || "https://placeholder.supabase.co",
    ENV.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        realtime: {
            transport: ws,
        },
    }
);

export default supabase;
