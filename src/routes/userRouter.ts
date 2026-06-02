import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import {
  checkEmail,
  createUser,
  deleteUser,
  getUserById,
  importUsers,
  listUsers,
  updatePermissions,
  updateUser,
} from "../controllers/userController.js";

const router = Router();

// Listar / buscar — admin ou receptionist (service valida)
router.get("/users", requireAuth, asyncHandler(listUsers));
// router.get("/users", asyncHandler(listUsers));
router.get("/users/check-email/:email", requireAuth, asyncHandler(checkEmail));
router.get("/users/:id", requireAuth, asyncHandler(getUserById));

// Criar — admin only
router.post("/users", requireAuth, requirePermission("manageEmployees"), asyncHandler(createUser));
router.post("/users/import", requireAuth, requirePermission("manageEmployees"), asyncHandler(importUsers));

// Editar — admin edita qualquer, user edita a si mesmo (service valida)
router.patch("/users/:id", requireAuth, asyncHandler(updateUser));
router.put("/users/:id", requireAuth, asyncHandler(updateUser));

// Permissões — admin only
router.patch("/users/:id/permissions", requireAuth, requirePermission("manageEmployees"), asyncHandler(updatePermissions));

// Remover — admin only
router.delete("/users/:id", requireAuth, requirePermission("manageEmployees"), asyncHandler(deleteUser));

export default router;
