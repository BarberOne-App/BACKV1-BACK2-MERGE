import { Router } from "express";
import { asyncHandler } from "../../../../../middleware/asyncHandler.js";
import {
  cancelAppointment,
  checkEligibility,
  createAppointment,
  createCustomer,
  getAvailability,
  getAppointmentById,
  health,
  listPaymentMethods,
  listPlans,
  listProfessionals,
  listServices
} from "../controllers/AreschatIntegrationController.js";
import { requireIntegrationAuth } from "../middlewares/requireIntegrationAuth.js";

const router = Router();
const basePath = "/api/integrations/areschat/v1";

router.get(`${basePath}/health`, asyncHandler(health));
router.get(
  `${basePath}/services`,
  requireIntegrationAuth,
  asyncHandler(listServices)
);
router.get(
  `${basePath}/professionals`,
  requireIntegrationAuth,
  asyncHandler(listProfessionals)
);
router.get(
  `${basePath}/plans`,
  requireIntegrationAuth,
  asyncHandler(listPlans)
);
router.get(
  `${basePath}/payment-methods`,
  requireIntegrationAuth,
  asyncHandler(listPaymentMethods)
);
router.get(
  `${basePath}/availability`,
  requireIntegrationAuth,
  asyncHandler(getAvailability)
);
router.post(
  `${basePath}/customers/eligibility`,
  requireIntegrationAuth,
  asyncHandler(checkEligibility)
);
router.post(
  `${basePath}/customers`,
  requireIntegrationAuth,
  asyncHandler(createCustomer)
);
router.post(
  `${basePath}/appointments`,
  requireIntegrationAuth,
  asyncHandler(createAppointment)
);
router.get(
  `${basePath}/appointments/:id`,
  requireIntegrationAuth,
  asyncHandler(getAppointmentById)
);
router.post(
  `${basePath}/appointments/:id/cancel`,
  requireIntegrationAuth,
  asyncHandler(cancelAppointment)
);

export default router;
