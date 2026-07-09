// routes/platformSubscriptionRoutes.ts

import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  reactivateBarbershopPlatformSubscription,
} from "../controllers/platformSubscriptionController.js";

const router = Router();

router.post(
  "/barbershops/:barbershopId/reactivate-subscription",
  asyncHandler(reactivateBarbershopPlatformSubscription)
);

export default router;