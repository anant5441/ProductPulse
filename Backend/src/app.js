import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import apiRoutes from "./routes/index.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/error.middleware.js";
import ENV from "./config/env.js";

const app = express();

// Security / CORS configuration (Section 37)
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or cron jobs)
        if (!origin) return callback(null, true);

        // Match configured origins or localhost in dev
        if (
            ENV.NODE_ENV === "development" ||
            origin === ENV.CORS_ORIGIN ||
            origin.includes("localhost") ||
            origin.includes("vercel.app")
        ) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in initial stage, easily restricted via CORS_ORIGIN
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic rate limiting for standard API routes (100 reqs per 15 min per IP)
const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests from this IP, please try again later.",
        },
    },
});

app.use("/api", standardLimiter);

// Root routes for Render / platform health probes
app.get("/", (req, res) => {
    res.json({
        message: "ProductPulse API is running 🚀",
        version: "1.0.0",
        docs: "/api/health",
    });
});

app.head("/", (req, res) => {
    res.status(200).send();
});

// Mount all API routes under /api
app.use("/api", apiRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
