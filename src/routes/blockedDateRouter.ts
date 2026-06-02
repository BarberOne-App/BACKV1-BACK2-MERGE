import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createBlockedDate,
  deleteBlockedDate,
  listBlockedDates,
  updateBlockedDate,
} from "../controllers/blockedDateController.js";

const router = Router();

// Listar / verificar data — qualquer usuário logado (usado na tela de agendamento)
router.get("/blocked-dates", requireAuth, asyncHandler(listBlockedDates));

// Bloquear data — admin ou com permissão manageBlockedDates
router.post("/blocked-dates", requireAuth, requirePermission("manageBlockedDates"), asyncHandler(createBlockedDate));
router.put("/blocked-dates/:id", requireAuth, requirePermission("manageBlockedDates"), asyncHandler(updateBlockedDate));
router.patch("/blocked-dates/:id", requireAuth, requirePermission("manageBlockedDates"), asyncHandler(updateBlockedDate));

// Desbloquear data — admin ou com permissão manageBlockedDates
router.delete("/blocked-dates/:id", requireAuth, requirePermission("manageBlockedDates"), asyncHandler(deleteBlockedDate));

export default router;
