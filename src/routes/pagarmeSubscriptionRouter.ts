// routes/pagarmeSubscriptionRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
	createPagarmeBarbershopPlatformSubscriptionController,
	createPagarmeClientSubscriptionController,
	getBarbershopPlatformSubscriptionController,
	cancelBarbershopPlatformSubscriptionController,
} from '../controllers/pagarmeSubscriptionController.js';

const router = Router();

router.post('/client-subscriptions', requireAuth, createPagarmeClientSubscriptionController);
router.post('/barbershop-platform-subscriptions', requireAuth, createPagarmeBarbershopPlatformSubscriptionController);
router.get('/barbershop-platform-subscriptions/current', requireAuth, getBarbershopPlatformSubscriptionController);
router.post('/barbershop-platform-subscriptions/cancel', requireAuth, cancelBarbershopPlatformSubscriptionController);

export default router;
