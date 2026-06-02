import { Prisma } from "@prisma/client";
import prisma from "../database/database.js";
import { notFound } from "../errors/index.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

function rounds() {
  return Number(process.env.BCRYPT_SALT_ROUNDS || 10);
}

function normalizeEmail(email?: string | null) {
  const value = String(email || "")
    .trim()
    .toLowerCase();

  return value.length ? value : null;
}

function normalizePhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

function serializeUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isAdmin: user.is_admin,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    barbershopId: user.current_barbershop_id,
    barbershop: user.current_barbershop
      ? {
          id: user.current_barbershop.id,
          name: user.current_barbershop.name,
          slug: user.current_barbershop.slug,
          status: user.current_barbershop.status,
        }
      : null,
  };
}

type ListParams = {
  q?: string;
  status?: "active" | "inactive" | "blocked" | "pending";
  plan?: string;
  subscriptionStatus?: "active" | "paused" | "cancelled" | "expired" | "none";
  createdFrom?: string;
  createdTo?: string;
  page: number;
  limit: number;
  sortBy: "name" | "createdAt" | "updatedAt" | "status";
  sortOrder: "asc" | "desc";
};

function normalizeDateStart(isoDate?: string) {
  if (!isoDate) return undefined;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeDateEnd(isoDate?: string) {
  if (!isoDate) return undefined;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapSortBy(sortBy: ListParams["sortBy"]) {
  if (sortBy === "name") return "name";
  if (sortBy === "updatedAt") return "updated_at";
  if (sortBy === "status") return "status";
  return "created_at";
}

function buildWhere(params: ListParams): Prisma.barbershopsWhereInput {
  const where: Prisma.barbershopsWhereInput = {};

  const q = String(params.q || "").trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { cnpj: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  const createdFrom = normalizeDateStart(params.createdFrom);
  const createdTo = normalizeDateEnd(params.createdTo);
  if (createdFrom || createdTo) {
    where.created_at = {
      ...(createdFrom ? { gte: createdFrom } : {}),
      ...(createdTo ? { lte: createdTo } : {}),
    };
  }

  if (params.plan) {
    where.subscriptions = {
      some: {
        status: "active",
        subscription_plans: {
          name: {
            contains: params.plan,
            mode: "insensitive",
          },
        },
      },
    };
  }

  if (params.subscriptionStatus) {
    if (params.subscriptionStatus === "none") {
      where.subscriptions = { none: {} };
    } else {
      where.subscriptions = {
        some: {
          status: params.subscriptionStatus,
        },
      };
    }
  }

  return where;
}

async function buildBarbershopMetrics(barbershopId: string) {
  const [appointmentsCount, servicesCount, productsCount, clientsCount, employeesCount] =
    await Promise.all([
      prisma.appointments.count({ where: { barbershop_id: barbershopId } }),
      prisma.services.count({ where: { barbershop_id: barbershopId } }),
      prisma.products.count({ where: { barbershop_id: barbershopId } }),
      prisma.users.count({
        where: {
          role: "client",
          barbershop_links: { some: { barbershop_id: barbershopId } },
        },
      }),
      prisma.users.count({
        where: {
          role: { in: ["barber", "receptionist", "admin"] },
          barbershop_links: { some: { barbershop_id: barbershopId } },
        },
      }),
    ]);

  return {
    appointmentsCount,
    servicesCount,
    productsCount,
    clientsCount,
    employeesCount,
  };
}

export async function getSuperAdminDashboardService() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    totalBarbershops,
    activeBarbershops,
    inactiveBarbershops,
    blockedBarbershops,
    pendingBarbershops,
    activeSubscriptions,
    newBarbershopsThisMonth,
  ] = await Promise.all([
    prisma.barbershops.count(),
    prisma.barbershops.count({ where: { status: "active" } }),
    prisma.barbershops.count({ where: { status: "inactive" } }),
    prisma.barbershops.count({ where: { status: "blocked" } }),
    prisma.barbershops.count({ where: { status: "pending" } }),
    prisma.subscriptions.count({ where: { status: "active" } }),
    prisma.barbershops.count({ where: { created_at: { gte: startOfMonth } } }),
  ]);

  return {
    totalBarbershops,
    activeBarbershops,
    inactiveBarbershops,
    blockedBarbershops,
    pendingBarbershops,
    activeSubscriptions,
    newBarbershopsThisMonth,
  };
}

export async function listSuperAdminUsersService(params: {
  q?: string;
  role?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.usersWhereInput = {};

  const q = String(params.q || "").trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { cpf: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.role) {
    where.role = params.role as any;
  }

  const skip = (params.page - 1) * params.limit;

  const [total, users] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_admin: true,
        created_at: true,
        updated_at: true,
        current_barbershop_id: true,
        current_barbershop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return {
    items: users.map(serializeUser),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function listSuperAdminBarbershopsService(params: ListParams) {
  const where = buildWhere(params);
  const skip = (params.page - 1) * params.limit;

  const [total, barbershops] = await Promise.all([
    prisma.barbershops.count({ where }),
    prisma.barbershops.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: {
        [mapSortBy(params.sortBy)]: params.sortOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        cnpj: true,
        email: true,
        phone: true,
        status: true,
        created_at: true,
        blocked_reason: true,
        blocked_at: true,
        deactivated_at: true,
      },
    }),
  ]);

  const items = await Promise.all(
    barbershops.map(async (shop) => {
      // Busca o admin user da barbearia
      const adminUser = await prisma.users.findFirst({
        where: {
          role: "admin",
          barbershop_links: { some: { barbershop_id: shop.id } },
        },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          created_at: true,
        },
      });

      // Busca a subscription do admin (usando seu user_id) na barbearia
      let adminSubscription = null;
      if (adminUser) {
        adminSubscription = await prisma.subscriptions.findFirst({
          where: {
            barbershop_id: shop.id,
            user_id: adminUser.id,
            status: { in: ["active", "paused"] },
          },
          orderBy: [
            { last_billing_at: "desc" },
            { created_at: "desc" },
          ],
          select: {
            id: true,
            status: true,
            created_at: true,
            next_billing_at: true,
            last_billing_at: true,
            subscription_plans: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        });
      }

      const metrics = await buildBarbershopMetrics(shop.id);

      return {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        cnpj: shop.cnpj,
        email: shop.email,
        phone: shop.phone,
        status: shop.status,
        createdAt: shop.created_at,
        blockedReason: shop.blocked_reason,
        blockedAt: shop.blocked_at,
        deactivatedAt: shop.deactivated_at,
        admin: adminUser,
        subscription: adminSubscription || null,
        metrics,
      };
    })
  );

  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function getSuperAdminBarbershopByIdService(barbershopId: string) {
  const shop = await prisma.barbershops.findUnique({
    where: { id: barbershopId },
    select: {
      id: true,
      name: true,
      slug: true,
      cnpj: true,
      email: true,
      phone: true,
      status: true,
      blocked_reason: true,
      blocked_at: true,
      deactivated_at: true,
      created_at: true,
      updated_at: true,
      stripe_connect_account_id: true,
      stripe_connect_charges_enabled: true,
      stripe_connect_payouts_enabled: true,
      stripe_connect_details_submitted: true,
      stripe_connect_onboarding_completed_at: true,
      subscriptions: {
        orderBy: { created_at: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          started_at: true,
          next_billing_at: true,
          ended_at: true,
          created_at: true,
          users: {
            select: { id: true, name: true, email: true },
          },
          subscription_plans: {
            select: {
              id: true,
              name: true,
              price: true,
              cuts_per_month: true,
            },
          },
        },
      },
    },
  });

  if (!shop) throw notFound("Barbearia não encontrada");

  // Busca o admin user da barbearia
  const adminUser = await prisma.users.findFirst({
    where: {
      role: "admin",
      barbershop_links: { some: { barbershop_id: barbershopId } },
    },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      created_at: true,
    },
  });

  // Busca a subscription do admin (usando seu user_id) na barbearia
  let adminSubscription = null;
  if (adminUser) {
    adminSubscription = await prisma.subscriptions.findFirst({
      where: {
        barbershop_id: barbershopId,
        user_id: adminUser.id,
        status: { in: ["active", "paused"] },
      },
      orderBy: [
        { last_billing_at: "desc" },
        { created_at: "desc" },
      ],
      select: {
        id: true,
        status: true,
        started_at: true,
        next_billing_at: true,
        ended_at: true,
        created_at: true,
        subscription_plans: {
          select: {
            id: true,
            name: true,
            price: true,
            cuts_per_month: true,
          },
        },
      },
    });
  }

  const metrics = await buildBarbershopMetrics(barbershopId);

  return {
    ...shop,
    admin: adminUser,
    subscription: adminSubscription || null,
    metrics,
  };
}

export async function listSuperAdminBarbershopUsersService(barbershopId: string) {
  const shop = await prisma.barbershops.findUnique({ where: { id: barbershopId }, select: { id: true } });
  if (!shop) throw notFound("Barbearia não encontrada");

  const users = await prisma.users.findMany({
    where: {
      barbershop_links: {
        some: { barbershop_id: barbershopId },
      },
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      is_admin: true,
      current_barbershop_id: true,
      created_at: true,
      updated_at: true,
    },
  });

  return {
    items: users,
    total: users.length,
  };
}

export async function updateSuperAdminBarbershopStatusService(params: {
  barbershopId: string;
  status: "active" | "inactive" | "blocked" | "pending";
  reason?: string | null;
}) {
  const existing = await prisma.barbershops.findUnique({ where: { id: params.barbershopId }, select: { id: true } });
  if (!existing) throw notFound("Barbearia não encontrada");

  const data: Prisma.barbershopsUpdateInput = {
    status: params.status,
    updated_at: new Date(),
  };

  if (params.status === "blocked") {
    data.blocked_reason = String(params.reason || "Bloqueada pelo Super Admin");
    data.blocked_at = new Date();
    data.deactivated_at = null;
  } else if (params.status === "inactive") {
    data.deactivated_at = new Date();
    data.blocked_reason = null;
    data.blocked_at = null;
  } else {
    data.blocked_reason = null;
    data.blocked_at = null;
    data.deactivated_at = null;
  }

  const updated = await prisma.barbershops.update({
    where: { id: params.barbershopId },
    data,
    select: {
      id: true,
      name: true,
      status: true,
      blocked_reason: true,
      blocked_at: true,
      deactivated_at: true,
      updated_at: true,
    },
  });

  return updated;
}

export async function resetUserPasswordService(params: { userId: string; newPassword?: string }) {
  const user = await prisma.users.findUnique({ where: { id: params.userId }, select: { id: true, email: true, name: true } });
  if (!user) throw notFound("Usuário não encontrado");

  const password = params.newPassword && String(params.newPassword).trim().length > 0
    ? String(params.newPassword)
    : crypto.randomBytes(6).toString("hex");

  const passwordHash = await bcrypt.hash(password, rounds());

  await prisma.users.update({ where: { id: params.userId }, data: { password_hash: passwordHash, updated_at: new Date() } });

  // Return plain temporary password so Super Admin can communicate it to the user securely
  return { id: params.userId, password };
}

export async function updateSuperAdminUserService(params: {
  userId: string;
  data: {
    email?: string;
    phone?: string | null;
    newPassword?: string;
  };
}) {
  const current = await prisma.users.findUnique({
    where: { id: params.userId },
    select: { id: true },
  });

  if (!current) throw notFound("Usuário não encontrado");

  const updateData: Prisma.usersUpdateInput = {
    updated_at: new Date(),
  };

  if (params.data.email !== undefined) {
    updateData.email = normalizeEmail(params.data.email);
  }

  if (params.data.phone !== undefined) {
    updateData.phone = normalizePhone(params.data.phone);
  }

  if (params.data.newPassword !== undefined) {
    updateData.password_hash = await bcrypt.hash(String(params.data.newPassword), rounds());
  }

  const updated = await prisma.users.update({
    where: { id: params.userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      is_admin: true,
      created_at: true,
      updated_at: true,
      current_barbershop_id: true,
      current_barbershop: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  return serializeUser(updated);
}
