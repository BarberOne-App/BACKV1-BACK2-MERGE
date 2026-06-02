import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
} from "../controllers/paymentMethodController.js";

const router = Router();

// Listar métodos do usuário — qualquer logado
router.get("/payment-methods", requireAuth, asyncHandler(listPaymentMethods));

// Salvar método — qualquer logado
router.post("/payment-methods", requireAuth, asyncHandler(createPaymentMethod));

// Definir como padrão — qualquer logado
router.patch("/payment-methods/:id/set-default", requireAuth, asyncHandler(setDefaultPaymentMethod));

// Remover método — qualquer logado
router.delete("/payment-methods/:id", requireAuth, asyncHandler(deletePaymentMethod));

export default router;
