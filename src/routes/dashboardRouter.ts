import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getDashboard } from "../controllers/dashboardController.js";

const router = Router();

router.get("/admin/dashboard/stats", requireAuth, asyncHandler(getDashboard));

export default router;
