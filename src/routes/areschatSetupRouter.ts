import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  generateAresChatSetupData,
  getAresChatSetupData,
  updateAresChatOutboundConfig,
} from "../controllers/areschatSetupController.js";

const router = Router();

router.get(
  "/integrations/areschat/setup-data",
  requireAuth,
  asyncHandler(getAresChatSetupData)
);

router.post(
  "/integrations/areschat/setup-data/generate",
  requireAuth,
  asyncHandler(generateAresChatSetupData)
);

router.put(
  "/integrations/areschat/setup-data/outbound",
  requireAuth,
  asyncHandler(updateAresChatOutboundConfig)
);

export default router;
