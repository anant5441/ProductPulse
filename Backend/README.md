# ProductPulse Backend 🚀

ProductPulse is a product price and stock tracking backend service for monitoring products from the **INE mock storefront** (`https://demo.inelabteamdev.com/`).

---

## 🌟 Features

- **Product Discovery & Search**: Search products in local cache/database with fallback live discovery from the INE store.
- **Tracked Products Management**: Start/stop tracking with duplicate protection and configurable scrape intervals (default: 120 minutes).
- **Automated Price Scraping**: Automates price retrieval with cryptographic challenge handshakes, proof-of-work solving, and XOR decryption.
- **Honest Attempt Logging**: Every scrape attempt is logged in `scrape_attempts` with response times, HTTP statuses, and error types.
- **Strict Data Validation**: Prevents corrupted, zero, or invalid price rows from entering `price_history`.
- **Chart & Stock History APIs**: Lightweight endpoints for frontend charts and analytics.
- **External Cron Scheduling**: Secured `/api/cron/scrape` endpoint triggered by [cron-job.org](https://cron-job.org) with header authentication (`x-cron-secret`).

---

## 🏗️ Architecture

```
Frontend (Vercel / Local)
   │
   │ HTTP (REST)
   ▼
Express.js Backend (Render / Local)
   │
   ├──▶ Supabase PostgreSQL (products, tracked_products, scrape_runs, scrape_attempts, price_history)
   │
   └──▶ Scraper Engine (Playwright / API Handshake)
           │
           ▼
        INE Mock Store (demo.inelabteamdev.com)
```

---

## ⚙️ Environment Variables

Create `.env` in the `Backend/` directory:

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

STORE_BASE_URL=https://demo.inelabteamdev.com

SCRAPER_HEADLESS=true
SCRAPER_MAX_ATTEMPTS=3
SCRAPER_NAVIGATION_TIMEOUT=30000
SCRAPER_REVEAL_TIMEOUT=20000
MAX_CONCURRENT_SCRAPES=2

CORS_ORIGIN=http://localhost:5173
CRON_SECRET=your-secret-cron-token
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

## 📡 API Endpoints

### 🩺 Health & Probes
- `GET /api/health` — Service health check.

### 📦 Products
- `GET /api/products/search?q=domus` — Search products across database and storefront.
- `GET /api/products/:id` — Get product details, tracking status, and latest price observation.

### 🎯 Tracked Products
- `GET /api/tracked-products` — List all active tracked products with latest prices and stock status.
- `POST /api/tracked-products` — Start tracking a product.
  ```json
  { "productId": "UUID" }
  ```
- `DELETE /api/tracked-products/:id` — Untrack a product (sets `is_active: false`, preserves all historical data).

### 🔍 Scraping
- `POST /api/scrape/product/:trackedProductId` — Manually trigger a scrape for one tracked product.
- `POST /api/cron/scrape` — External cron endpoint.
  - Header: `x-cron-secret: YOUR_CRON_SECRET`

### 📈 History & Logs
- `GET /api/tracked-products/:id/history` — Full price observations history.
- `GET /api/tracked-products/:id/price-history` — Chart-ready array: `[{ timestamp, price }]`.
- `GET /api/tracked-products/:id/stock-history` — Stock history: `[{ timestamp, stock, status }]`.
- `GET /api/tracked-products/:id/scrape-logs` — All scraper attempts with status, timings, and error types.
- `GET /api/tracked-products/:id/status` — Latest tracking and scrape summary.

---

## ⏰ Cron-job.org Configuration

To trigger automatic price updates every 2 hours:
1. Go to [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **URL**: `https://your-backend.onrender.com/api/cron/scrape`
   - **Method**: `POST`
   - **Schedule**: Every 2 hours (`0 */2 * * *`)
   - **Headers**:
     - `x-cron-secret`: `<YOUR_CRON_SECRET>`

---

## 🚢 Deployment to Render

1. Create a **Web Service** on [Render](https://render.com).
2. Connect your repository and set Root Directory to `Backend`.
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Add all environment variables in Render's dashboard.
