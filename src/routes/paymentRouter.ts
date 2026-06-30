import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createAppointmentPayment,
  createExtraPayment,
  createManualSubscriptionPayment,
  createPayment,
  deleteExtraPayment,
  getPaymentById,
  listAllPayments,
  listAppointmentPayments,
  listExtraPayments,
  listPayments,
  updatePayment,
} from "../controllers/paymentController.js";

const router = Router();

/* ═══════ Payments (assinaturas) ═══════ */

// Listar — admin vê todos, client vê os seus
router.get("/payments/all", requireAuth, asyncHandler(listAllPayments));
router.get("/payments", requireAuth, asyncHandler(listPayments));
router.get("/payments/:id", requireAuth, asyncHandler(getPaymentById));

// Criar pagamento — admin
router.post("/payments", requireAuth, requirePermission("managePayments"), asyncHandler(createPayment));
router.post("/payments/subscriptions/manual", requireAuth, requirePermission("managePayments"), asyncHandler(createManualSubscriptionPayment));

/* ═══════ Appointment Payments ═══════ */

// Listar — admin vê todos, client vê os seus
router.get("/appointmentPayments", requireAuth, asyncHandler(listAppointmentPayments));

// Criar pagamento de agendamento — admin / recepcionista
// router.post("/appointmentPayments", requireAuth, requireAdmin, asyncHandler(createAppointmentPayment));

router.post("/appointmentPayments", requireAuth, asyncHandler(createAppointmentPayment));

// Atualizar (marcar como pago, etc.) — admin
router.patch("/appointmentPayments/:id", requireAuth, requirePermission("managePayments"), asyncHandler(updatePayment));

// Também permite atualizar pagamento de assinatura
router.patch("/payments/:id", requireAuth, requirePermission("managePayments"), asyncHandler(updatePayment));

/* ═══════ Extra Payments ═══════ */

router.get("/extraPayments", requireAuth, requirePermission("managePayments"), asyncHandler(listExtraPayments));
router.post("/extraPayments", requireAuth, requirePermission("managePayments"), asyncHandler(createExtraPayment));
router.patch("/extraPayments/:id", requireAuth, requirePermission("managePayments"), asyncHandler(updatePayment));
router.delete("/extraPayments/:id", requireAuth, requirePermission("managePayments"), asyncHandler(deleteExtraPayment));

export default router;
