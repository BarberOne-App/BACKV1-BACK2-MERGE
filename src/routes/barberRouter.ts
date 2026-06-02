import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createBarber,
  deleteBarber,
  getBarberById,
  linkUser,
  listBarbers,
  updateBarber,
} from "../controllers/barberController.js";

const router = Router();

// Listar / buscar — qualquer usuário logado (usado na Home e agendamento)
router.get("/barbers", requireAuth, asyncHandler(listBarbers));
router.get("/barbers/:id", requireAuth, asyncHandler(getBarberById));

// Criar / editar / vincular / remover — admin only
router.post("/barbers", requireAuth, requirePermission("manageEmployees"), asyncHandler(createBarber));
router.put("/barbers/:id", requireAuth, requirePermission("manageEmployees"), asyncHandler(updateBarber));
router.patch("/barbers/:id", requireAuth, requirePermission("manageEmployees"), asyncHandler(updateBarber));
router.patch("/barbers/:id/link-user", requireAuth, requirePermission("manageEmployees"), asyncHandler(linkUser));
router.delete("/barbers/:id", requireAuth, requirePermission("manageEmployees"), asyncHandler(deleteBarber));

export default router;
