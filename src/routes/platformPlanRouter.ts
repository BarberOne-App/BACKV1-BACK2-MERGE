import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireSuperAdmin } from '../middleware/authMiddleware.js';
import {
  listPublicPlatformPlansController,
  listActivePlatformPlansController,
  listPlatformPlansController,
  getPlatformPlanByIdController,
  createPlatformPlanController,
  updatePlatformPlanController,
  deletePlatformPlanController,
} from '../controllers/platformPlanController.js';

const router = Router();

// Rota pública (sem autenticação) — usada pela Landing Page
router.get('/public/platform-plans', asyncHandler(listPublicPlatformPlansController));

// Rota autenticada — retorna todos os planos ativos (sem filtro de is_public)
router.get('/platform-plans/active', requireAuth, asyncHandler(listActivePlatformPlansController));

// Rotas administrativas — protegidas por SuperAdmin
router.get('/platform-plans', requireAuth, requireSuperAdmin, asyncHandler(listPlatformPlansController));
router.get('/platform-plans/:id', requireAuth, requireSuperAdmin, asyncHandler(getPlatformPlanByIdController));
router.post('/platform-plans', requireAuth, requireSuperAdmin, asyncHandler(createPlatformPlanController));
router.put('/platform-plans/:id', requireAuth, requireSuperAdmin, asyncHandler(updatePlatformPlanController));
router.patch('/platform-plans/:id', requireAuth, requireSuperAdmin, asyncHandler(updatePlatformPlanController));
router.delete('/platform-plans/:id', requireAuth, requireSuperAdmin, asyncHandler(deletePlatformPlanController));

export default router;
