import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT,
    FINGERPRINT_CORES,
    FINGERPRINT_FRAMES,
    FINGERPRINT_HASH_BYTES,
    FINGERPRINT_SCREEN,
    MIN_DWELL_MS,
    MIN_HOVER_MOVES,
    POW_ATTEMPT_BUDGET,
    PRICE_RETRIES,
    PRICE_RETRY_DELAY_MS,
    RETRYABLE_STATUS,
    SHARED_SECRET,
    USER_AGENT,
} from "./constants.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ChallengeSchema = z.object({
    salt: z.string().min(1),
    ts: z.number(),
    difficulty: z.number().int().positive(),
    csig: z.string(),
    wasm: z.string().min(1),
});

export const SessionSchema = z.object({
    token: z.string().min(1),
    expiresInMs: z.number().int().positive(),
});

export const EncryptedQuoteSchema = z.object({
    productId: z.number().int().positive(),
    v: z.number().int(),
    e: z.string().min(1),
    serverTime: z.number(),
});

// the store sends this info basedo nthe sales and other offer but p m c t are always there
export const QuoteSchema = z.object({
    p: z.number(),
    m: z.number(),
    n: z.number().optional(),
    b: z.number().optional(),
    s: z.number().optional(),
    c: z.string(),
    t: z.number(),
    r: z.number().optional(),
    rc: z.number().optional(),
    sl: z.string().optional(),
    dd: z.number().optional(),
    v: z.string().optional(),
    g: z.number().optional(),
    x: z.number().optional(),
    f: z.string().optional(),
});

export class PriceStructureError extends Error {
    constructor(message) {
        super(message);
        this.name = "PriceStructureError";
    }
}

export class PriceChallengeError extends Error {
    constructor(message) {
        super(message);
        this.name = "PriceChallengeError";
    }
}

class RetryableError extends Error {
    constructor(message) {
        super(message);
        this.name = "RetryableError";
    }
}

const sha256hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const sha256bytes = (value) => createHash("sha256").update(value, "utf8").digest();

// a plausible interaction snapshot. the server only sees the hash of this string, so the
// numbers don't have to be real - they just have to be self consistent and look like a
// hover: >= 8 moves, >= 600ms dwell and a trusted click.
//
// the canvas/gl hashes do have to look real though: an all-zero fingerprint gets rejected
// outright (the store's bot check), and a real canvas hash is never degenerate
export function buildAttestation(options = {}) {
    const { now = Date.now(), env = {}, moves: moveCount = MIN_HOVER_MOVES + 2 } = options;
    const startedAt = now - 3000;
    const moves = [];

    for (let i = 0; i < moveCount; i++) {
        moves.push([300 + i * 17, 400 + i * 11, startedAt + i * 90]);
    }

    return JSON.stringify({
        env: {
            canvas: randomBytes(FINGERPRINT_HASH_BYTES).toString("hex"),
            gl: randomBytes(FINGERPRINT_HASH_BYTES).toString("hex"),
            hc: FINGERPRINT_CORES,
            scr: FINGERPRINT_SCREEN,
            frames: FINGERPRINT_FRAMES,
            at: now,
            ...env,
        },
        ix: {
            hoverAt: now - MIN_DWELL_MS - 300,
            dwellMs: MIN_DWELL_MS + 300,
            moves,
            clickAt: now,
            trusted: true,
        },
    });
}

export function seedFor(salt, sessionKey) {
    return parseInt(sha256hex(`${SHARED_SECRET}|seed|${salt}|${sessionKey}`).slice(0, 8), 16) | 0;
}

export function deriveFor(salt, wasmOutput, sessionKey) {
    return sha256hex(`${SHARED_SECRET}|derive|${salt}|${wasmOutput | 0}|${sessionKey}`);
}

// the store wants difficulty leading zero nibbles on sha256(salt:nonce). difficulty 3 is
// ~4k hashes, so it's not a barrier, just a question to answer
export function solveProofOfWork(salt, difficulty) {
    const target = "0".repeat(difficulty);

    for (let nonce = 0; nonce < POW_ATTEMPT_BUDGET; nonce++) {
        if (sha256hex(`${salt}:${nonce}`).slice(0, difficulty) === target) return nonce;
    }

    throw new PriceStructureError(
        `Proof of work at difficulty ${difficulty} exceeded ${POW_ATTEMPT_BUDGET} attempts`,
    );
}

// the "encryption": the xor key is sha256 of the bundled constant plus the token the store
// hands us in the same flow, so decryption needs nothing we weren't already given
export function decryptQuote(encrypted, token) {
    const key = sha256bytes(`${SHARED_SECRET}|enc|${token}`);
    const ciphertext = Buffer.from(encrypted, "base64");
    const plaintext = Buffer.alloc(ciphertext.length);

    for (let i = 0; i < ciphertext.length; i++) {
        plaintext[i] = ciphertext[i] ^ key[i % key.length];
    }

    return plaintext.toString("utf8");
}

async function evaluateWasm(base64, input) {
    try {
        const module = await WebAssembly.compile(Buffer.from(base64, "base64"));
        const instance = await WebAssembly.instantiate(module);
        return instance.exports.f(input) | 0;
    } catch (error) {
        throw new PriceStructureError(`Could not evaluate the challenge wasm: ${error.message}`);
    }
}

// one request, no retry. transient failures come back as RetryableError so the retry
// happens around the whole handshake, not around a call that already spent the single-use
// token
async function storeRequest(path, options = {}) {
    const {
        method = "GET",
        body,
        token,
        baseUrl = process.env.STORE_BASE_URL ?? DEFAULT_BASE_URL,
        timeout = DEFAULT_TIMEOUT,
        headers = {},
        signal,
    } = options;

    const url = new URL(path, baseUrl);
    const response = await fetch(url, {
        method,
        redirect: "follow",
        headers: {
            "user-agent": USER_AGENT,
            accept: "application/json",
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
            : AbortSignal.timeout(timeout),
    });

    if (RETRYABLE_STATUS.has(response.status)) {
        throw new RetryableError(`Retryable HTTP ${response.status} for ${url.pathname}`);
    }
    if (response.status === 401 || response.status === 403) {
        throw new PriceChallengeError(
            `Store rejected the interaction proof for ${url.pathname} (HTTP ${response.status})`,
        );
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url.pathname}`);
    }

    return { status: response.status, text: await response.text() };
}

function parseShape(schema, text, what, path) {
    try {
        return schema.parse(JSON.parse(text));
    } catch (error) {
        throw new PriceStructureError(`Unexpected ${what} payload from ${path}: ${error.message}`);
    }
}

// challenge -> session token -> encrypted quote. all three, every time: the token is
// scoped to GET /api/products/{id}/price, so it can't be reused for another product and
// scraping N products costs 3N requests, not N + 2
async function revealOnce(productId, options) {
    const challenge = parseShape(
        ChallengeSchema,
        (await storeRequest("/api/challenge", options)).text,
        "challenge",
        "/api/challenge",
    );

    const att = options.attestation ?? buildAttestation();
    const sessionKey = sha256hex(att);
    const wasmOutput = await evaluateWasm(challenge.wasm, seedFor(challenge.salt, sessionKey));
    const nonce = solveProofOfWork(challenge.salt, challenge.difficulty);
    const derived = deriveFor(challenge.salt, wasmOutput, sessionKey);

    const session = parseShape(
        SessionSchema,
        (
            await storeRequest("/api/session", {
                ...options,
                method: "POST",
                body: { ...challenge, nonce, derived, wasmOut: wasmOutput, att, productId },
            })
        ).text,
        "session",
        "/api/session",
    );

    const path = `/api/products/${productId}/price`;
    const payload = parseShape(
        EncryptedQuoteSchema,
        (await storeRequest(path, { ...options, token: session.token })).text,
        "price",
        path,
    );

    const quote = parseShape(
        QuoteSchema,
        decryptQuote(payload.e, session.token),
        "quote",
        path,
    );

    return {
        productId,
        price: quote.p,
        mrp: quote.m,
        sale: quote.n ?? null,
        badgePct: quote.b ?? null,
        stock: quote.s ?? null,
        currency: quote.c,
        rating: quote.r ?? null,
        ratingCount: quote.rc ?? null,
        seller: quote.sl ?? null,
        deliveryDays: quote.dd ?? null,
        variant: quote.v ?? null,
        format: quote.f ?? null,
        pending: quote.g === 1,
        triple: quote.x === 1,
        at: quote.t,
    };
}

// reveal one product's price
export async function fetchPrice(productId, options = {}) {
    const { retries = PRICE_RETRIES, ...requestOptions } = options;

    if (!Number.isInteger(productId) || productId < 1) {
        throw new Error(`Invalid product id: ${productId}`);
    }

    for (let attempt = 1; ; attempt++) {
        try {
            return await revealOnce(productId, requestOptions);
        } catch (error) {
            if (!(error instanceof RetryableError) || attempt > retries) throw error;
            console.warn(
                `[price] attempt ${attempt} failed: ${error.message} (${retries - attempt + 1} left)`,
            );
            await sleep(PRICE_RETRY_DELAY_MS * attempt);
        }
    }
}

export default fetchPrice;
