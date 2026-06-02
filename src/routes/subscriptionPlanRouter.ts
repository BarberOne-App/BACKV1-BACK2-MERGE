import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createPlan,
  deletePlan,
  getPlanById,
  listPlans,
  updatePlan,
} from "../controllers/subscriptionPlanController.js";

const router = Router();

// Listar / buscar — qualquer usuário logado (exibido na tela de planos)
router.get("/subscription-plans", requireAuth, asyncHandler(listPlans));
router.get("/subscription-plans/:id", requireAuth, asyncHandler(getPlanById));

// CRUD — admin only
router.post("/subscription-plans", requireAuth, requirePermission("manageBenefits"), asyncHandler(createPlan));
router.put("/subscription-plans/:id", requireAuth, requirePermission("manageBenefits"), asyncHandler(updatePlan));
router.patch("/subscription-plans/:id", requireAuth, requirePermission("manageBenefits"), asyncHandler(updatePlan));
router.delete("/subscription-plans/:id", requireAuth, requirePermission("manageBenefits"), asyncHandler(deletePlan));

export default router;
