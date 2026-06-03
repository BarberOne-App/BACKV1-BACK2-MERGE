import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createEmployeePayment,
  createExtraEmployeePayment,
  getEmployeePayrollSummary,
  getMyPayrollSummary,
  listEmployeePayments,
  listExtraEmployeePayments,
} from "../controllers/employeePaymentController.js";

const router = Router();

// Rota do próprio barbeiro — deve vir ANTES das rotas admin para não colidir
router.get("/employeePayments/my-summary", requireAuth, asyncHandler(getMyPayrollSummary));

router.get("/employeePayments/summary", requireAuth, requireAdmin, asyncHandler(getEmployeePayrollSummary));
router.get("/employeePayments/extra", requireAuth, requireAdmin, asyncHandler(listExtraEmployeePayments));
router.post("/employeePayments/extra", requireAuth, requirePermission("managePayroll"), asyncHandler(createExtraEmployeePayment));
router.get("/employeePayments", requireAuth, requireAdmin, asyncHandler(listEmployeePayments));
router.post("/employeePayments", requireAuth, requirePermission("managePayroll"), asyncHandler(createEmployeePayment));

export default router;
