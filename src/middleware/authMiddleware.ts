
import { NextFunction, Request, Response } from "express";
import prisma from "../database/database.js";
import { verifyToken } from "../utils/jwt.js";
import { unauthorized, forbidden } from "../errors/index.js";

function isSuperAdminRole(role: unknown) {
  return String(role || "") === "super_admin";
}

function getBearerToken(req: Request) {
  const auth = req.header("authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return next(unauthorized("Token ausente"));

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return next(unauthorized("Token inválido"));
  }

  const user = await prisma.users.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      current_barbershop_id: true,
      role: true,
      is_admin: true,
      name: true,
      email: true,
      permissions: true,
      barbershops: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!user) return next(unauthorized("Usuário inválido"));
  const isSuperAdmin = isSuperAdminRole(user.role) || isSuperAdminRole(payload.role);

  if (!isSuperAdmin) {
    if (!user.current_barbershop_id) {
      return next(unauthorized("Usuário sem barbearia ativa"));
    }

    // evita token trocado entre barbearias
    if (!payload.barbershopId || user.current_barbershop_id !== payload.barbershopId) {
      return next(unauthorized("Token inválido para essa barbearia"));
    }
  }

  const shopStatus = String(user.barbershops?.status || "");

  if (!isSuperAdmin && (shopStatus === "blocked" || shopStatus === "inactive")) {
    return next(forbidden("Acesso indisponível para esta barbearia"));
  }

  req.user = {
    id: user.id,
    barbershopId: user.current_barbershop_id || "",
    role: user.role as any,
    isAdmin: user.is_admin,
    name: user.name,
    email: user.email ?? "",
    permissions: (user.permissions as any) || {},
  };

  next();
}

export function requireRole(...roles: Array<"admin" | "barber" | "client">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized("Não autenticado"));
    if (!roles.includes(req.user.role as any)) return next(forbidden("Sem permissão"));
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized("Não autenticado"));
  if (req.user.role !== "admin" && !req.user.isAdmin && !isSuperAdminRole(req.user.role)) {
    return next(forbidden("Apenas admin"));
  }
  next();
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized("Não autenticado"));
  if (!isSuperAdminRole(req.user.role)) {
    return next(forbidden("Apenas Super Admin"));
  }
  next();
}

export function requireAdminOrReceptionist(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized("Não autenticado"));

  const role = String(req.user.role || "");
  const isAdmin = role === "admin" || req.user.isAdmin;
  const isReceptionist = role === "receptionist";
  const canManageAppointments = req.user.permissions?.manageAgendamentos === true;

  if (!isAdmin && !isReceptionist && !canManageAppointments) {
    return next(forbidden("Apenas admin ou recepcionista"));
  }

  next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized("Não autenticado"));
    
    const isAdmin = req.user.role === "admin" || req.user.isAdmin || isSuperAdminRole(req.user.role);
    if (isAdmin) return next(); // admin tem todas as permissões
    
    const permissions = req.user.permissions || {};
    if (!(permissions as any)[permission]) {
      return next(forbidden(`Sem permissão: ${permission}`));
    }

    // Services antigos validam apenas actorRole/isAdmin.
    // A permissao exigida nesta rota equivale a admin somente nesta requisicao.
    req.user.role = "admin";
    req.user.isAdmin = true;
    
    next();
  };
}

/**
 * Middleware que tenta autenticar via JWT, mas **não bloqueia** se não houver token.
 * Usado nas rotas de pagamento enquanto o frontend não integra o login real.
 * TODO: remover quando o auth estiver integrado — trocar por requireAuth.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return next(); // segue sem req.user

  try {
    const payload = verifyToken(token);
    const user = await prisma.users.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        current_barbershop_id: true,
        role: true,
        is_admin: true,
        name: true,
        email: true,
        permissions: true,
      },
    });

    const isSuperAdmin = isSuperAdminRole(user?.role) || isSuperAdminRole(payload.role);

    if (
      user &&
      (isSuperAdmin || (user.current_barbershop_id && user.current_barbershop_id === payload.barbershopId))
    ) {
      req.user = {
        id: user.id,
        barbershopId: user.current_barbershop_id || "",
        role: user.role as any,
        isAdmin: user.is_admin,
        name: user.name,
        email: user.email ?? "",
        permissions: (user.permissions as any) || {},
      };
    }
  } catch {
    // Token inválido — segue sem req.user
  }

  next();
}
