import { Router } from 'express';
import {
  createPagarmeOrderController,
  createPagarmeRecipientController,
  getPagarmeOrderStatusController,
  getPagarmeRecipientController,
  getPagarmeWithdrawalBalanceController,
  pagarmeWebhookController,
  requestPagarmeWithdrawalController,
  updatePagarmeRecipientController,
} from '../controllers/pagarmeController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/orders', requireAuth, createPagarmeOrderController);
router.get('/orders/:orderId/status', requireAuth, getPagarmeOrderStatusController);

// Use esta rota no cadastro/edição da barbearia para substituir o onboarding do Stripe Connect.
router.post('/recipients', requireAuth, requireAdmin, createPagarmeRecipientController);
router.get('/recipients/:recipientId', requireAuth, requireAdmin, getPagarmeRecipientController);
router.put('/recipients/:recipientId', requireAuth, requireAdmin, updatePagarmeRecipientController);

router.get('/withdrawals/balance', requireAuth, requireAdmin, getPagarmeWithdrawalBalanceController);
router.post('/withdrawals', requireAuth, requireAdmin, requestPagarmeWithdrawalController);

// Essa rota precisa ficar sem requireAuth, porque quem chama é o Pagar.me.
router.post('/webhook', pagarmeWebhookController);

export default router;
