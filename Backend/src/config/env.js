import dotenv from "dotenv";
dotenv.config();

export const ENV = {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
    NODE_ENV: process.env.NODE_ENV || "development",
    
    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    
    // Scraper settings
    STORE_BASE_URL: process.env.STORE_BASE_URL || "https://demo.inelabteamdev.com",
    SCRAPER_HEADLESS: process.env.SCRAPER_HEADLESS !== "false",
    SCRAPER_MAX_ATTEMPTS: process.env.SCRAPER_MAX_ATTEMPTS ? parseInt(process.env.SCRAPER_MAX_ATTEMPTS, 10) : 3,
    SCRAPER_NAVIGATION_TIMEOUT: process.env.SCRAPER_NAVIGATION_TIMEOUT ? parseInt(process.env.SCRAPER_NAVIGATION_TIMEOUT, 10) : 30000,
    SCRAPER_REVEAL_TIMEOUT: process.env.SCRAPER_REVEAL_TIMEOUT ? parseInt(process.env.SCRAPER_REVEAL_TIMEOUT, 10) : 20000,
    MAX_CONCURRENT_SCRAPES: process.env.MAX_CONCURRENT_SCRAPES ? parseInt(process.env.MAX_CONCURRENT_SCRAPES, 10) : 2,

    // Security & CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
    CRON_SECRET: process.env.CRON_SECRET || "productpulse-cron-secret-key",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

    // SendGrid Alerts
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "alerts@productpulse.com",
};

export default ENV;
