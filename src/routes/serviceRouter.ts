// src/routers/serviceRouter.ts
import { Router } from "express";
import {
  createService,
  deleteService,
  getServiceById,
  importServices,
  listServices,
  reactivateService,
  updateService,
} from "../controllers/serviceController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const route = Router();

// list / details
route.get("/services", requireAuth, asyncHandler(listServices));
route.get("/services/:id", requireAuth, asyncHandler(getServiceById));

// create / update / deactivate / reactivate
route.post("/services", requireAuth, requirePermission("addServices"), asyncHandler(createService));
route.post("/services/import", requireAuth, requirePermission("manageServices"), asyncHandler(importServices));
route.patch("/services/:id", requireAuth, requirePermission("editServices"), asyncHandler(updateService));
route.patch(
  "/services/:id/reactivate",
  requireAuth,
  requirePermission("manageServices"),
  asyncHandler(reactivateService)
);
route.delete("/services/:id", requireAuth, requirePermission("manageServices"), asyncHandler(deleteService));

export default route;
