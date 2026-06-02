import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdminOrReceptionist, requireAuth } from "../middleware/authMiddleware.js";
import {
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getAvailableSlots,
  listAppointments,
  sendAppointmentEmailTest,
  updateAppointment,
} from "../controllers/appointmentController.js";

const router = Router();

// Consulta de slots disponíveis — qualquer usuário logado (usado na tela de agendamento)
router.get(
  "/appointments/available-slots",
  requireAuth,
  asyncHandler(getAvailableSlots)
);

// Listar / detalhar agendamentos — qualquer usuário logado (filtro por role no service)
router.get("/appointments", requireAuth, asyncHandler(listAppointments));
router.get("/appointments/:id", requireAuth, asyncHandler(getAppointmentById));

// Criar agendamento — qualquer usuário logado (client cria para si, admin/recepcionista para qualquer)
router.post("/appointments", requireAuth, asyncHandler(createAppointment));

// Atualizar agendamento (status, notes, barbeiro) — validado no service por permissão/dono
router.patch("/appointments/:id", requireAuth, asyncHandler(updateAppointment));

// Disparo manual de e-mail de teste para validação de SMTP
router.post(
  "/appointments/test-email",
  requireAuth,
  requireAdminOrReceptionist,
  asyncHandler(sendAppointmentEmailTest)
);

// Cancelar agendamento (soft) — admin ou o próprio cliente (verificação futura no service)
router.delete("/appointments/:id", requireAuth, asyncHandler(deleteAppointment));

export default router;