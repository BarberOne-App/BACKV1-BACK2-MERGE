import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createSavedCard,
  deleteSavedCard,
  listSavedCards,
  patchSavedCard,
} from "../controllers/savedCardController.js";

const router = Router();

router.get("/savedCards", requireAuth, asyncHandler(listSavedCards));
router.post("/savedCards", requireAuth, asyncHandler(createSavedCard));
router.patch("/savedCards/:id", requireAuth, asyncHandler(patchSavedCard));
router.delete("/savedCards/:id", requireAuth, asyncHandler(deleteSavedCard));

export default router;
