import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createDependent,
  deleteDependent,
  listDependents,
  updateDependent,
} from "../controllers/dependentController.js";

const router = Router();

router.get("/dependents", requireAuth, asyncHandler(listDependents));
router.post("/dependents", requireAuth, asyncHandler(createDependent));
router.patch("/dependents/:id", requireAuth, asyncHandler(updateDependent));
router.delete("/dependents/:id", requireAuth, asyncHandler(deleteDependent));

export default router;
