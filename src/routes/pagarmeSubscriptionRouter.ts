// routes/pagarmeSubscriptionRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
	createPagarmeBarbershopPlatformSubscriptionController,
	createPagarmeClientSubscriptionController,
} from '../controllers/pagarmeSubscriptionController.js';

const router = Router();

router.post('/client-subscriptions', requireAuth, createPagarmeClientSubscriptionController);
router.post('/barbershop-platform-subscriptions', requireAuth, createPagarmeBarbershopPlatformSubscriptionController);

export default router;
