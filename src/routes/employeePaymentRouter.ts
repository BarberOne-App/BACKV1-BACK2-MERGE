import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createEmployeePayment,
  createExtraEmployeePayment,
  getEmployeePayrollSummary,
  listEmployeePayments,
  listExtraEmployeePayments,
} from "../controllers/employeePaymentController.js";

const router = Router();

router.get("/employeePayments/summary", requireAuth, requireAdmin, asyncHandler(getEmployeePayrollSummary));
router.get("/employeePayments/extra", requireAuth, requireAdmin, asyncHandler(listExtraEmployeePayments));
router.post("/employeePayments/extra", requireAuth, requirePermission("managePayroll"), asyncHandler(createExtraEmployeePayment));
router.get("/employeePayments", requireAuth, requireAdmin, asyncHandler(listEmployeePayments));
router.post("/employeePayments", requireAuth, requirePermission("managePayroll"), asyncHandler(createEmployeePayment));

export default router;
