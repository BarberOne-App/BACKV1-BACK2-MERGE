
import { Router } from "express";
import { googleAuth, listPublicBarbershops, login, logout, me, refresh, registerBarber, registerBarbershop, registerClient, registerSuperAdmin, switchBarbershop, forgotPassword, resetPassword } from "../controllers/authController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/auth/login", asyncHandler(login));
router.post("/auth/register/barbershop", asyncHandler(registerBarbershop));
router.post("/barbershops/register", asyncHandler(registerBarbershop));
router.get("/barbershops/public", asyncHandler(listPublicBarbershops));
router.post("/auth/register/client", asyncHandler(registerClient));
router.post("/auth/google", asyncHandler(googleAuth));
router.post("/auth/setup/super-admin", asyncHandler(registerSuperAdmin));
router.post("/auth/register/barber", requireAuth, requirePermission("manageEmployees"), asyncHandler(registerBarber));

router.get("/auth/me", requireAuth, asyncHandler(me));
router.post("/auth/refresh", asyncHandler(refresh));
router.post("/auth/switch-barbershop", requireAuth, asyncHandler(switchBarbershop));
router.post("/auth/logout", asyncHandler(logout));

router.post("/auth/forgot-password", asyncHandler(forgotPassword));
router.post("/auth/reset-password", asyncHandler(resetPassword));

export default router;
