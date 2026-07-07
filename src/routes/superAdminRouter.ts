import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  getSuperAdminBarbershopById,
  getSuperAdminDashboard,
  listSuperAdminBarbershops,
  listSuperAdminUsers,
  listSuperAdminBarbershopUsers,
  updateSuperAdminUser,
  updateSuperAdminBarbershopStatus,
  activatePixPlatformSubscription,
  resetUserPassword,
  listSuperAdminBarbershopIntegrationCredentials,
  createSuperAdminBarbershopIntegrationCredential,
  revokeSuperAdminIntegrationCredential,
} from "../controllers/superAdminController.js";
import {
  createSuperAdminFeatureUpdate,
  deleteSuperAdminFeatureUpdate,
  listActiveFeatureUpdates,
  listSuperAdminFeatureUpdates,
  updateSuperAdminFeatureUpdate,
} from "../controllers/featureUpdateController.js";

const router = Router();

router.get(
  "/feature-updates",
  requireAuth,
  asyncHandler(listActiveFeatureUpdates)
);

router.get(
  "/super-admin/dashboard",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(getSuperAdminDashboard)
);

router.get(
  "/super-admin/barbershops",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminBarbershops)
);

router.get(
  "/super-admin/barbershops/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(getSuperAdminBarbershopById)
);

router.get(
  "/super-admin/barbershops/:id/users",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminBarbershopUsers)
);

router.patch(
  "/super-admin/barbershops/:id/status",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(updateSuperAdminBarbershopStatus)
);

router.post(
  "/super-admin/barbershops/:id/platform-subscription/pix/activate",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(activatePixPlatformSubscription)
);

router.get(
  "/super-admin/barbershops/:id/integration-credentials",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminBarbershopIntegrationCredentials)
);

router.post(
  "/super-admin/barbershops/:id/integration-credentials",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(createSuperAdminBarbershopIntegrationCredential)
);

router.patch(
  "/super-admin/integration-credentials/:credentialId/revoke",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(revokeSuperAdminIntegrationCredential)
);

router.get(
  "/super-admin/feature-updates",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminFeatureUpdates)
);

router.post(
  "/super-admin/feature-updates",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(createSuperAdminFeatureUpdate)
);

router.patch(
  "/super-admin/feature-updates/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(updateSuperAdminFeatureUpdate)
);

router.delete(
  "/super-admin/feature-updates/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(deleteSuperAdminFeatureUpdate)
);

router.get(
  "/super-admin/users",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminUsers)
);

router.patch(
  "/super-admin/users/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(updateSuperAdminUser)
);

router.patch(
  '/super-admin/users/:id/password',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(resetUserPassword)
);

export default router;
