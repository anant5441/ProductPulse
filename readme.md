# ProductPulse

**A full-stack product price & stock tracker** that monitors products on the [INE mock storefront](https://demo.inelabteamdev.com/), detects price drops and restocks, and delivers alerts via in-app notifications and SendGrid email.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Scraping Schedule](#scraping-schedule)
- [Design Note: Reliable Scraping](#design-note-reliable-scraping)

---

## Overview

ProductPulse is split into two workspaces:

| Workspace | Stack | Purpose |
|---|---|---|
| **[Backend](./Backend/)** | Node.js, Express v5, Supabase, SendGrid | REST API, scraper engine, alert system, cron scheduling |
| **[Frontend](./Frontend/)** | React 19, Vite 8, TailwindCSS 4, Recharts | Dashboard UI, product catalog, tracking details, notifications |

### What It Does

1. **Discovers** 1,000 products from the INE store and syncs them to a Supabase database.
2. **Tracks** any product the user selects, scraping its price and stock at configurable intervals (default: every 2 hours).
3. **Detects** price drops (with customizable thresholds) and back-in-stock transitions.
4. **Notifies** via in-app notifications (bell icon with click-to-navigate) and rich HTML emails through SendGrid.
5. **Logs** every scrape attempt with response time, HTTP status, and classified error types for full observability.
6. **Flags** structural page changes when the store's HTML layout shifts unexpectedly.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ProductPulse                              │
│                                                                  │
│  ┌────────────────────┐          ┌────────────────────────────┐  │
│  │   Frontend (Vite)  │  HTTP    │      Backend (Express)     │  │
│  │                    │ ──────►  │                            │  │
│  │  • Dashboard       │          │  • REST API Layer          │  │
│  │  • Product Catalog │          │  • Scraper Engine          │  │
│  │  • Tracking View   │          │  │  ├─ API Handshake       │  │
│  │  • Notifications   │          │  │  ├─ Retry + Backoff     │  │
│  │  • Alert Settings  │          │  │  ├─ Validator           │  │
│  │                    │          │  │  └─ Error Classifier     │  │
│  └────────────────────┘          │  • Alert Engine            │  │
│                                  │  │  ├─ Price-drop eval     │  │
│                                  │  │  ├─ Back-in-stock eval  │  │
│                                  │  │  └─ Cooldown check      │  │
│                                  │  • Notification Service    │  │
│                                  │  • Email Service (SendGrid)│  │
│                                  └──────────┬─────────────────┘  │
│                                             │                    │
│                              ┌──────────────┼──────────────┐     │
│                              │              │              │     │
│                              ▼              ▼              ▼     │
│                         Supabase       SendGrid       INE Store  │
│                        (Postgres)      (Email)      (Target Site)│
│                                                                  │
│  External Trigger: cron-job.org ──► POST /api/cron/scrape        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Prerequisites

- **Node.js** ≥ 18.x and **npm** ≥ 9.x
- A **Supabase** account (free tier works)
- A **SendGrid** account (optional — only needed for email alerts)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ProductPulse.git
cd ProductPulse
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

Create `Backend/.env` with your credentials (see [Environment Variables](#environment-variables) below).

Sync the product catalog (loads all 1,000 products into Supabase):

```bash
npm run db:sync
```

Start the backend:

```bash
npm run dev          # Development (with hot-reload)
npm start            # Production
```

The API server starts on **http://localhost:5000**.

### 3. Frontend Setup

```bash
cd Frontend
npm install
```

Create `Frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The app opens at **http://localhost:5173**.

### 4. Supabase Database

Create the following tables in your Supabase project. The schema is documented in detail in the [Backend README](./Backend/README.md#-database-schema-supabase):

- `products` — Master product catalog
- `tracked_products` — Active trackers with scrape interval config
- `price_history` — Scraped price/stock observations
- `scrape_runs` — Batch scrape run records
- `scrape_attempts` — Individual attempt logs
- `alert_preferences` — Per-product alert configuration
- `notifications` — Generated alerts (in-app + email status)

---

## Environment Variables

### Backend (`Backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | API server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | — | Supabase service role key |
| `STORE_BASE_URL` | No | `https://demo.inelabteamdev.com` | Target store URL |
| `SCRAPER_HEADLESS` | No | `true` | Run scraper headlessly |
| `SCRAPER_MAX_ATTEMPTS` | No | `3` | Max retry attempts per scrape |
| `SCRAPER_NAVIGATION_TIMEOUT` | No | `30000` | Navigation timeout (ms) |
| `SCRAPER_REVEAL_TIMEOUT` | No | `20000` | Price reveal timeout (ms) |
| `MAX_CONCURRENT_SCRAPES` | No | `2` | Parallel scrape limit |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `CRON_SECRET` | No | `productpulse-cron-secret-key` | Cron endpoint auth token |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL (for emails) |
| `SENDGRID_API_KEY` | No | — | SendGrid API key (needs Mail Send permission) |
| `SENDGRID_FROM_EMAIL` | No | `alerts@productpulse.com` | Verified sender email |

### Frontend (`Frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | `http://localhost:5000/api` | Backend API URL |

---

## Scraping Schedule

### How Products Get Scraped

Each tracked product has a **configurable scrape interval** (field: `scrape_interval_minutes`, default: **120 minutes**). Users can change this per product via the frontend's Alert Settings tab or the `PATCH /api/tracked-products/:id` endpoint.

### Automatic Scraping via cron-job.org

A free external cron service ([cron-job.org](https://cron-job.org)) hits the backend every **2 hours**:

| Setting | Value |
|---|---|
| **URL** | `https://your-backend-url/api/cron/scrape` |
| **Method** | `POST` |
| **Schedule** | `0 */2 * * *` (every 2 hours) |
| **Header** | `x-cron-secret: <your CRON_SECRET value>` |

When the cron fires, the backend:

1. Fetches all active tracked products.
2. Filters to only those that are **due** (i.e., `last_success_at + scrape_interval_minutes < now`).
3. Scrapes due products with controlled concurrency (default: 2 parallel).
4. Records results, evaluates alerts, and sends notifications.

### Manual Scraping

Users can also trigger a scrape instantly from the UI or via:

```bash
# Single product
POST /api/scrape/product/<trackedProductId>

# All due products
POST /api/scheduler/run-due?force=true
```

---

## Design Note: Reliable Scraping

### How the Scraper Actually Works

The INE mock store **does not expose prices in plain HTML**. It protects pricing data behind a multi-step cryptographic handshake. You can't just `fetch()` a product page and read the price — the store requires you to solve a challenge, prove you're a real interaction, and decrypt the response. Our scraper replicates this entire protocol in pure Node.js (no browser needed).

#### The 3-Step Cryptographic Handshake

Every price scrape performs **3 sequential API requests** to the store. The token from each step is single-use and scoped to one product, so scraping N products costs exactly 3N requests.

```
Step 1: GET /api/challenge
   └─► Store returns: salt, difficulty, WASM binary (base64), timestamp, csig

Step 2: POST /api/session
   └─► We send back:
       • Proof-of-Work nonce (solved by brute-force hashing)
       • WASM evaluation result (compiled & executed in-process)
       • Derived key (SHA-256 of shared secret + salt + WASM output)
       • Attestation blob (simulated browser fingerprint + interaction)
   └─► Store returns: single-use Bearer token (scoped to this product)

Step 3: GET /api/products/{id}/price (with Bearer token)
   └─► Store returns: encrypted quote (base64 ciphertext)
   └─► We decrypt via XOR using SHA-256(shared_secret + token) as key
   └─► Plaintext JSON contains: price, MRP, stock, rating, seller, etc.
```

#### Key Algorithms Implemented

| Algorithm | File | What It Does |
|---|---|---|
| **Proof-of-Work** | `Scraper/price.js` → `solveProofOfWork()` | Brute-forces a nonce where `SHA-256(salt:nonce)` has N leading zero nibbles (difficulty). Budget: up to 5M attempts. |
| **WASM Evaluation** | `Scraper/price.js` → `evaluateWasm()` | Compiles and runs the store's base64-encoded WASM binary with a seeded input. The output feeds into the derived key. |
| **XOR Decryption** | `Scraper/price.js` → `decryptQuote()` | Decrypts the price payload using `SHA-256(shared_secret\|enc\|token)` as a repeating XOR key over the base64-decoded ciphertext. |
| **Attestation Builder** | `Scraper/price.js` → `buildAttestation()` | Generates a plausible browser fingerprint (canvas hash, WebGL hash, screen size, frame timings) and simulated mouse hover/click interaction data. The store hashes this to detect bots. |
| **Derived Key** | `Scraper/price.js` → `deriveFor()` | Computes `SHA-256(shared_secret\|derive\|salt\|wasmOutput\|sessionKey)` to prove we correctly evaluated the challenge. |
| **Zod Schema Validation** | `Scraper/price.js`, `Scraper/product.js` | Every API response (challenge, session, encrypted quote, decrypted quote, product details) is validated against strict Zod schemas before use. |

#### Why This Approach (Not Playwright)

We use **direct API calls with cryptographic challenge-solving** instead of headless browser automation because:

- **Speed**: 1–3 seconds per product (vs. 8–15s with Playwright).
- **Memory**: Zero browser processes — just Node.js `fetch()` + `crypto` + `WebAssembly`.
- **Reliability**: No DOM timing issues, no "element not found" failures, no intermittent page load failures.
- **Deployability**: Works on any hosting tier (including Render free tier) without Chromium binaries.

Playwright is included as a dev dependency for debugging only — it's not used in the production scraping flow.

### Additional Reliability Layers

#### Retry with Exponential Backoff

Every scrape gets up to **3 attempts** (configurable via `SCRAPER_MAX_ATTEMPTS`). The price handshake itself has an additional inner retry loop (up to 5 retries with 300ms × attempt delay) for transient HTTP failures (408, 429, 500, 502, 503, 504).

Between outer retries, we apply exponential backoff:

- Attempt 1 → immediate
- Attempt 2 → wait 2 seconds
- Attempt 3 → wait 4 seconds

Each attempt is logged individually to `scrape_attempts` with its own timing, HTTP status, and classified error type.

#### Strict Data Validation

Before any price is written to the database, it passes through **two layers** of validation:

1. **Zod schemas** (in `Scraper/price.js`): Validate the raw store response structure — every field type-checked before use.
2. **Business rules** (in `src/scraper/validator.js`): Reject corrupted data:
   - Price must be a **positive number** (rejects `0`, `null`, `NaN`).
   - Product name and SKU must be present and non-empty.
   - Original price must be ≥ current price (catches corrupted discount data).
   - Discount percentage must be between 0–100.

If validation fails, the attempt is marked `validation_failed` and retried.

#### Error Classification

Every failure is categorized into a standard type (`NAVIGATION_TIMEOUT`, `CHALLENGE_ERROR`, `PRICE_NOT_FOUND`, `VALIDATION_ERROR`, `HTTP_ERROR`, etc.) — making it easy to diagnose patterns in the scrape logs UI.

#### Concurrency Control

An in-memory mutex (`Set`) prevents the same product from being scraped simultaneously by overlapping cron runs. Batch cron runs use controlled concurrency (`MAX_CONCURRENT_SCRAPES = 2`) to avoid hammering the store.

#### Non-Blocking Alert Evaluation

Alert evaluation (price-drop detection, email dispatch) runs **after** the price is safely saved. If alerts fail, the scrape data is still preserved — alert failures never corrupt or block the core scraping pipeline.

### Trade-Offs

| Decision | Trade-off |
|---|---|
| **Replaying the store's crypto protocol** | Fast and reliable, but tightly coupled to the store's specific challenge/WASM/XOR mechanism. If the store changes its handshake, the scraper needs updating. |
| **Hardcoded shared secret** | The `SHARED_SECRET` constant is embedded in the store's client-side JS. If they rotate it, we need to re-extract it. |
| **Simulated attestation** | We generate fake-but-plausible browser fingerprints. If the store adds server-side fingerprint verification beyond hashing, this could break. |
| **External cron (cron-job.org) over internal scheduler** | Avoids running `setInterval` inside Node.js (which dies on Render's free tier spin-down). But adds an external dependency. |
| **Soft-delete for untracking** | Setting `is_active: false` preserves all historical data — but the `tracked_products` table grows over time. |
| **Per-product scrape intervals** | Gives users control but adds complexity — the cron must evaluate each product's individual schedule. |
| **Cooldown windows on alerts** | Prevents notification spam, but a user might miss a genuine second drop within the cooldown period. |
| **No WebSocket push** | Notifications are fetched via polling (on bell click), not pushed in real-time. Simpler to deploy, but not instant. |

### What AI Tools Got Wrong (and How We Fixed It)

#### 1. SendGrid API Key Permissions

The AI initially generated a SendGrid integration that looked correct, but when tested, every email request returned a **401 Unauthorized**. The root cause: the AI assumed a default SendGrid API key would have mail-send permissions. In reality, SendGrid requires you to explicitly grant `Mail Send` scope (or use "Full Access") when creating the key. We fixed this by updating the key's permissions in the SendGrid dashboard and adding a clear diagnostic error message in `emailService.js` so future 401s are immediately understandable.

#### 2. Product Catalog Sync Off-By-Four

The initial catalog sync logic loaded products from the INE store's paginated API, but it **missed products 1–4** because the external IDs started at `1` while the sync script started its page offset at a value that skipped the first page. This left us with 996 products instead of 1,000. We caught this by comparing `SELECT COUNT(*)` against the known catalog size and fixed the sync script to reconcile missing IDs explicitly.

#### 3. Email Landing in Spam

The AI-generated email templates used a generic `from` address (`alerts@productpulse.com`) without any DNS authentication. Every email went straight to spam. We fixed this by:

- Setting up **Sender Identity verification** in SendGrid.
- Configuring **DKIM** and **SPF** DNS records.
- Switching the sender name to `ProductPulse Alerts` (a human-recognizable name).
- Rewriting the email copy from transactional/robotic language to a warm, conversational tone.

#### 4. Alert Evaluation on First Scrape

The AI's first implementation fired an alert on the very first scrape of any product (comparing against a non-existent "previous" price of `0`), which immediately sent false price-drop notifications for every newly tracked product. We fixed this by adding a guard: **no alerts are generated when there's no previous observation to compare against.**

#### 5. Schema Validation Gaps

Early iterations didn't validate the store's API responses before using them — if the store returned an unexpected shape (e.g., a missing field), the scraper would crash with an opaque TypeError deep in the pipeline. We added Zod schemas (`ChallengeSchema`, `SessionSchema`, `EncryptedQuoteSchema`, `QuoteSchema`, `ProductSchema`) to validate every response at the boundary, producing clear `PriceStructureError` / `ProductStructureError` messages instead.

---

<p align="center">
  <strong>ProductPulse</strong> — Built for the INE Full-Stack Developer Assessment
</p>
