import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  cancelSubscription,
  checkOverdue,
  createSubscription,
  getSubscriptionById,
  listSubscriptions,
  renewSubscription,
  toggleRecurring,
  updateSubscription,
} from "../controllers/subscriptionController.js";

const router = Router();

// Listar — qualquer logado (clientes veem só as suas no service)
router.get("/subscriptions", requireAuth, asyncHandler(listSubscriptions));
router.get("/subscriptions/:id", requireAuth, asyncHandler(getSubscriptionById));

// Criar — admin / recepcionista
router.post("/subscriptions", requireAuth, asyncHandler(createSubscription));

// Atualizar (status, barbeiro mensal, etc.) — qualquer logado
router.patch("/subscriptions/:id", requireAuth, asyncHandler(updateSubscription));

// Ações de assinatura — admin
router.patch("/subscriptions/:id/cancel", requireAuth, requirePermission("manageBenefits"), asyncHandler(cancelSubscription));
router.patch("/subscriptions/:id/renew", requireAuth, requirePermission("manageBenefits"), asyncHandler(renewSubscription));
router.patch("/subscriptions/:id/toggle-recurring", requireAuth, requirePermission("manageBenefits"), asyncHandler(toggleRecurring));

// Job endpoint — admin
router.post("/subscriptions/check-overdue", requireAuth, requirePermission("manageBenefits"), asyncHandler(checkOverdue));

export default router;
