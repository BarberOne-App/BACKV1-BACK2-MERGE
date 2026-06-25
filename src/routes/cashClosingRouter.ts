import { Router } from "express";
import {
  createCashClosing,
  getCashClosingPreview,
  getCashClosingReport,
  listCashClosings,
} from "../controllers/cashClosingController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/cashClosings", requireAuth, requirePermission("managePayments"), asyncHandler(listCashClosings));
router.get("/cashClosings/preview", requireAuth, requirePermission("managePayments"), asyncHandler(getCashClosingPreview));
router.get("/cashClosings/:id/report", requireAuth, requirePermission("managePayments"), asyncHandler(getCashClosingReport));
router.post("/cashClosings", requireAuth, requirePermission("managePayments"), asyncHandler(createCashClosing));

export default router;
