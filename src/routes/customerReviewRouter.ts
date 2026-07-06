import { Router } from "express";
import { createCustomerReview, listCustomerReviews } from "../controllers/customerReviewController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/reviews", requireAuth, asyncHandler(listCustomerReviews));
router.post("/reviews", requireAuth, asyncHandler(createCustomerReview));

export default router;
