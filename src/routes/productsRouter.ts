import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  importProducts,
  listProducts,
  reactivateProduct,
  updateProduct,
} from "../controllers/productsController.js";

const router = Router();

// todos precisam estar autenticados (barbershop vem do token)
// router.get("/products", requireAuth, asyncHandler(listProducts));
// router.get("/products/:id", requireAuth, asyncHandler(getProductById));

router.get("/products", requireAuth, asyncHandler(listProducts));
router.get("/products/:id", requireAuth, asyncHandler(getProductById));

// service já bloqueia se não for admin, mas pode deixar assim mesmo:
router.post(
  "/products/import",
  requireAuth,
  requirePermission("manageProducts"),
  asyncHandler(importProducts)
);
router.post("/products", requireAuth, requirePermission("addProducts"), asyncHandler(createProduct));
router.patch("/products/:id", requireAuth, requirePermission("editProducts"), asyncHandler(updateProduct));
router.put("/products/:id", requireAuth, requirePermission("editProducts"), asyncHandler(updateProduct));
router.patch(
  "/products/:id/reactivate",
  requireAuth,
  requirePermission("manageProducts"),
  asyncHandler(reactivateProduct)
);
router.delete("/products/:id", requireAuth, requirePermission("manageProducts"), asyncHandler(deleteProduct));

export default router;
