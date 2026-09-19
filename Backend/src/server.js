import app from "./app.js";
import ENV from "./config/env.js";
import logger from "./utils/logger.js";

const PORT = ENV.PORT;

const server = app.listen(PORT, () => {
    logger.info(`ProductPulse Server running on http://localhost:${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received: closing HTTP server");
    server.close(() => {
        logger.info("HTTP server closed");
    });
});

process.on("SIGINT", () => {
    logger.info("SIGINT signal received: closing HTTP server");
    server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
    });
});

export default server;