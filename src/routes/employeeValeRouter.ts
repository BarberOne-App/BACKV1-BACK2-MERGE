import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  createEmployeeVale,
  deleteEmployeeVale,
  listEmployeeVales,
} from "../controllers/employeeValeController.js";

const router = Router();

router.get("/employeeVales", requireAuth, requireAdmin, asyncHandler(listEmployeeVales));
router.post("/employeeVales", requireAuth, requireAdmin, asyncHandler(createEmployeeVale));
router.delete("/employeeVales/:id", requireAuth, requireAdmin, asyncHandler(deleteEmployeeVale));

export default router;
