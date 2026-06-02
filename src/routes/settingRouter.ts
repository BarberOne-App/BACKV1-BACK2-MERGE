import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
    getBarbershopProfile,
    getSettings,
    upsertSettings,
    getHomeInfo,
    upsertHomeInfo,
    updateBarbershopProfile,
} from "../controllers/settingsController.js";

const router = Router();

// ler: qualquer usuário autenticado
router.get("/barbershop/profile", requireAuth, asyncHandler(getBarbershopProfile));
router.get("/settings", requireAuth, asyncHandler(getSettings));
router.get("/home-info", requireAuth, asyncHandler(getHomeInfo));

// escrever: só admin
router.put("/barbershop/profile", requireAuth, requirePermission("manageSettings"), asyncHandler(updateBarbershopProfile));
router.put("/settings", requireAuth, requirePermission("manageSettings"), asyncHandler(upsertSettings));
router.put("/home-info", requireAuth, requirePermission("manageSettings"), asyncHandler(upsertHomeInfo));

export default router;
