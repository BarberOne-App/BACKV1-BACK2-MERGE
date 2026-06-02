import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createGalleryImage,
  deleteGalleryImage,
  listGallery,
  updateGalleryImage,
} from "../controllers/galleryController.js";

const router = Router();

// Listar fotos — qualquer logado (exibido na Home)
router.get("/gallery", requireAuth, asyncHandler(listGallery));

// Upload / criar imagem — admin only
router.post("/gallery", requireAuth, requirePermission("manageGallery"), asyncHandler(createGalleryImage));

// Atualizar imagem — admin only
router.put("/gallery/:id", requireAuth, requirePermission("manageGallery"), asyncHandler(updateGalleryImage));

// Remover imagem — admin only
router.delete("/gallery/:id", requireAuth, requirePermission("manageGallery"), asyncHandler(deleteGalleryImage));

export default router;
