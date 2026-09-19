import { Router } from "express";
import { runDueScrapes } from "../../Scheduler/index.js";
import { listDue } from "../../Scheduler/Models/trackedProducts.js";
import { successResponse } from "../utils/response.js";

const router = Router();

/**
 * GET & POST /api/scheduler/run-due
 * Trigger due scrape runner (Supports ?force=true or body { force: true })
 */
const handleRunDue = async (req, res, next) => {
    try {
        const isForce = req.query.force === "true" || req.query.force === "1" || req.body?.force === true;
        const summary = await runDueScrapes({ force: isForce });

        return successResponse(res, {
            message: "Scheduler run-due cycle completed",
            summary,
        });
    } catch (error) {
        next(error);
    }
};

router.get("/run-due", handleRunDue);
router.post("/run-due", handleRunDue);

/**
 * GET /api/scheduler/due
 * List all products currently due for scraping without running scrapes
 */
router.get("/due", async (req, res, next) => {
    try {
        const isForce = req.query.force === "true" || req.query.force === "1";
        const due = await listDue({ force: isForce });

        return successResponse(res, {
            totalDue: due.length,
            due,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
