import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../database/database.js";
import { signToken, signRefreshToken, verifyRefreshToken, signResetToken, verifyResetToken } from "../utils/jwt.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./emailService.js";
import { slugify, normalizeEmail } from "../utils/slugify.js";
import { badRequest, conflict, forbidden, notFound, serviceUnavailable, unauthorized } from "../errors/index.js";
import {
  createBarberProfile,
  createBarbershop,
  createUser,
  findBarbershopBySlug,
  listPublicBarbershops,
  findUserByEmail,
  findUserByEmailInBarbershop,
  findUserById,
  findUserByCpf
} from "../repository/authRepository.js";
import { expirePlatformSubscription } from "./subscriptionExpirationService.js";

function sendWelcomeEmailAfterRegistration(params: {
  to?: string | null;
  name: string;
  barbershopName?: string | null;
}) {
  if (!params.to) return;

  void sendWelcomeEmail({
    to: params.to,
    name: params.name,
    barbershopName: params.barbershopName,
  }).catch((error) => {
    console.error("[email] Falha ao enviar e-mail de boas-vindas:", error);
  });
}

function isPrismaUniqueError(e: any) {
  return e?.code === "P2002";
}

function rounds() {
  return Number(process.env.BCRYPT_SALT_ROUNDS || 10);
}

function generateTokenPair(payload: { userId: string; barbershopId: string | null; role: any; isAdmin: boolean }) {
  return {
    token: signToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

function needsProfileCompletion(user: {
  cpf?: string | null;
  phone?: string | null;
  birth_date?: Date | string | null;
  password_hash?: string | null;
  current_barbershop_id?: string | null;
}) {
  return !user.cpf || !user.phone || !user.birth_date || !user.password_hash || !user.current_barbershop_id;
}

function normalizeSubscriptionBarberRule(value: unknown): "fixed" | "free_choice" {
  return value === "free_choice" ? "free_choice" : "fixed";
}

function mapAuthUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf ?? null,
    birthDate: user.birth_date ?? null,
    role: user.role,
    isAdmin: user.is_admin,
    permissions: user.permissions ?? null,
    photoUrl: user.photo_url ?? null,
    googleId: user.google_id ?? null,
    authProvider: user.auth_provider ?? "local",
    emailVerified: user.email_verified ?? false,
  };
}

function mapAuthBarbershop(barbershop: any) {
  if (!barbershop) return null;

  return {
    id: barbershop.id,
    name: barbershop.name,
    slug: barbershop.slug,
    status: barbershop.status,
    logoUrl: barbershop.logoUrl ?? barbershop.logo_url ?? "",
  };
}

function buildAuthResponse(user: any, created = false) {
  const barbershop = mapAuthBarbershop(user.barbershops);
  const tokens = generateTokenPair({
    userId: user.id,
    barbershopId: barbershop?.id ?? null,
    role: user.role as any,
    isAdmin: user.is_admin,
  });

  return {
    ...tokens,
    created,
    requiresProfileCompletion: needsProfileCompletion(user),
    barbershop,
    currentBarbershop: barbershop,
    user: mapAuthUser(user),
  };
}

async function getGoogleProfile(accessToken: string) {
  if (!accessToken) throw badRequest("Token do Google nao informado");

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userInfoResponse.ok) {
    throw unauthorized("Token do Google invalido ou expirado");
  }

  const userInfo = (await userInfoResponse.json()) as any;
  const email = normalizeEmail(userInfo.email || "");
  if (!email) throw unauthorized("Conta Google sem e-mail confirmado");

  if (userInfo.email_verified !== true && userInfo.email_verified !== "true") {
    throw unauthorized("E-mail da conta Google nao esta verificado");
  }

  return {
    googleId: String(userInfo.sub || "").trim(),
    email,
    name: String(userInfo.name || email.split("@")[0]).trim(),
    picture: userInfo.picture ? String(userInfo.picture) : null,
  };
}
const TRIAL_PERIOD_DAYS = Number(process.env.TRIAL_PERIOD_DAYS || 14);

async function findGoogleAuthUser(email: string, googleId: string) {
  return prisma.users.findFirst({
    where: {
      OR: [
        { google_id: googleId },
        { email },
      ],
    },
    include: {
      barbershops: { select: { id: true, name: true, slug: true, status: true, logo_url: true } },
    },
  });
}

export async function loginService(params: { email: string; password: string; barbershopId?: string }) {
  const email = normalizeEmail(params.email);

  let user;
  if (params.barbershopId) {
    user = await prisma.users.findFirst({
      where: {
        email,
        user_barbershops: { some: { barbershop_id: params.barbershopId } }
      },
      include: {
        barbershops: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo_url: true,
            status: true,
            created_at: true,
            platform_subscription_status: true,
          },
        },
      },
    });
  }

  if (!user) {
    user = await findUserByEmail(email);
  }

  if (!user) throw unauthorized("Credenciais inválidas");

  const ok = await bcrypt.compare(params.password, user.password_hash);
  if (!ok) throw unauthorized("Credenciais inválidas");

  if (params.barbershopId && user.current_barbershop_id !== params.barbershopId) {
    const hasAccess = await prisma.users.findFirst({
      where: {
        id: user.id,
        user_barbershops: { some: { barbershop_id: params.barbershopId } }
      }
    });
    if (hasAccess) {
      user = await prisma.users.update({
        where: { id: user.id },
        data: { current_barbershop_id: params.barbershopId },
        include: {
          barbershops: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo_url: true,
              status: true,
              created_at: true,
              platform_subscription_status: true,
            },
          },
        },
      });
    }
  }

  const shop = user.barbershops;
  const isSuperAdmin = String(user.role) === "super_admin";
  const isBarbershopAdmin = String(user.role) === "admin";

  if (!shop && !isSuperAdmin) {
    throw notFound("Usuário não vinculado a nenhuma barbearia");
  }

  // A assinatura da plataforma pertence ao administrador da barbearia.
  // Clientes e demais colaboradores nao devem ser bloqueados por essa cobranca.
  if (isBarbershopAdmin && shop) {
    await expirePlatformSubscription(shop.id);

    const now = new Date();
    const currentSub = await prisma.barbershop_platform_subscriptions.findUnique({
      where: { barbershop_id: shop.id },
      select: { status: true, canceled_at: true, next_billing_date: true },
    });
    const hasActiveSub =
      currentSub !== null &&
      currentSub.status === "active" &&
      currentSub.canceled_at === null &&
      (currentSub.next_billing_date === null || currentSub.next_billing_date > now);

    if (!hasActiveSub) {
      const createdAt = shop.created_at instanceof Date
        ? shop.created_at
        : new Date(shop.created_at as string);

      const trialEndsAt = new Date(createdAt.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      // Assinatura existe mas expirou → bloqueia sempre, sem fallback para trial
      // Assinatura nunca existiu → verifica se o trial ainda está ativo
      const shouldBlock = currentSub !== null || now > trialEndsAt;

      if (shouldBlock) {
        const formatted = trialEndsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const message = currentSub !== null
          ? `A assinatura da barbearia "${shop.name}" expirou. Renove seu plano para continuar usando a plataforma.`
          : `O período de teste da barbearia "${shop.name}" expirou em ${formatted}. Assine um plano para continuar usando a plataforma.`;
        return {
          trialExpired: true,
          trialExpiredAt: trialEndsAt.toISOString(),
          barbershopId: shop.id,
          barbershopName: shop.name,
          message,
        };
      }
    }
  }

  return buildAuthResponse(user);
}

export async function googleAuthService(params: {
  accessToken: string;
  slug?: string | null;
  profileData?: {
    cpf?: string | null;
    phone?: string | null;
    birthDate?: string | Date | null;
    password?: string | null;
  };
}) {
  const googleProfile = await getGoogleProfile(params.accessToken);
  if (!googleProfile.googleId) {
    throw unauthorized("Token do Google sem identificador de usuÃ¡rio");
  }

  const slug = String(params.slug || "").trim();
  const shop = slug ? await findBarbershopBySlug(slug) : null;
  if (slug && !shop) throw notFound("Barbearia nÃ£o encontrada");

  const profileData = params.profileData || {};
  const cleanCpf = String(profileData.cpf || "").replace(/\D/g, "") || null;
  const cleanPhone = String(profileData.phone || "").replace(/\D/g, "") || null;
  const password = String(profileData.password || "").trim();

  if (cleanCpf) {
    const existingCpf = await findUserByCpf(cleanCpf);
    if (existingCpf && existingCpf.email !== googleProfile.email) {
      throw conflict("CPF jÃ¡ cadastrado");
    }
  }

  const existingUser = await findGoogleAuthUser(googleProfile.email, googleProfile.googleId);
  if (existingUser) {
    const updateData: any = {
      google_id: existingUser.google_id || googleProfile.googleId,
      auth_provider: "google",
      email_verified: true,
      photo_url: existingUser.photo_url || googleProfile.picture,
    };

    if (cleanCpf && !existingUser.cpf) updateData.cpf = cleanCpf;
    if (cleanPhone && !existingUser.phone) updateData.phone = cleanPhone;
    if (profileData.birthDate && !existingUser.birth_date) updateData.birth_date = new Date(profileData.birthDate);
    if (password) updateData.password_hash = await bcrypt.hash(password, rounds());

    if (shop) updateData.current_barbershop_id = shop.id;

    const updated = await prisma.users.update({
      where: { id: existingUser.id },
      data: {
        ...updateData,
        ...(shop
          ? {
            user_barbershops: {
              connectOrCreate: {
                where: {
                  user_id_barbershop_id: {
                    user_id: existingUser.id,
                    barbershop_id: shop.id,
                  },
                },
                create: { barbershop_id: shop.id },
              },
            },
          }
          : {}),
      },
      include: {
        barbershops: { select: { id: true, name: true, slug: true, status: true, logo_url: true } },
      },
    });

    return buildAuthResponse(updated);
  }

  const passwordHash = password
    ? await bcrypt.hash(password, rounds())
    : await bcrypt.hash(crypto.randomUUID(), rounds());

  const created = await prisma.users.create({
    data: {
      name: googleProfile.name,
      email: googleProfile.email,
      phone: cleanPhone,
      cpf: cleanCpf,
      birth_date: profileData.birthDate ? new Date(profileData.birthDate) : null,
      role: "client",
      is_admin: false,
      password_hash: passwordHash,
      google_id: googleProfile.googleId,
      auth_provider: "google",
      email_verified: true,
      photo_url: googleProfile.picture,
      current_barbershop_id: shop?.id ?? null,
      ...(shop
        ? {
          user_barbershops: {
            create: { barbershop_id: shop.id },
          },
        }
        : {}),
    },
    include: {
      barbershops: { select: { id: true, name: true, slug: true, status: true, logo_url: true } },
    },
  });

  sendWelcomeEmailAfterRegistration({
    to: created.email,
    name: created.name,
    barbershopName: shop?.name,
  });

  return buildAuthResponse(created, true);
}

export async function registerBarbershopService(params: {
  barbershopName: string;
  slug?: string;
  cnpj?: string;
  phone?: string;

  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  password: string;
  selectedPlan: string;
  subscriptionBarberRule?: string;
}) {
  const adminEmail = normalizeEmail(params.adminEmail);
  const slug = slugify(params.slug?.trim() || params.barbershopName);
  const subscriptionBarberRule = normalizeSubscriptionBarberRule(params.subscriptionBarberRule);

  const passwordHash = await bcrypt.hash(params.password, rounds());

  console.log("Plano selecionado:", params.selectedPlan);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shop = await createBarbershop(
        {
          name: params.barbershopName.trim(),
          slug,
          cnpj: params.cnpj ?? null,
          phone: params.phone ?? null,
          email: adminEmail,
          selectedPlan: params.selectedPlan,
        },
        tx
      );

      const existing = await findUserByEmailInBarbershop(shop.id, adminEmail, tx);
      if (existing) throw conflict("E-mail já cadastrado nessa barbearia");

      const user = await createUser(
        {
          barbershopId: shop.id,
          name: params.adminName.trim(),
          email: adminEmail,
          phone: params.adminPhone ?? params.phone ?? null,
          role: "admin",
          isAdmin: true,
          passwordHash,
        },
        tx
      );

      await tx.barbershop_settings.upsert({
        where: { barbershop_id: shop.id },
        update: { subscription_barber_rule: subscriptionBarberRule },
        create: {
          barbershop_id: shop.id,
          hidden_booking_payment_methods: [],
          subscription_barber_rule: subscriptionBarberRule,
        },
      });

      return { shop, user };
    });

    sendWelcomeEmailAfterRegistration({
      to: result.user.email,
      name: result.user.name,
      barbershopName: result.shop.name,
    });

    const tokens = generateTokenPair({
      userId: result.user.id,
      barbershopId: result.shop.id,
      role: result.user.role as any,
      isAdmin: result.user.is_admin,
    });

    return {
      ...tokens,
      selectedPlan: params.selectedPlan ?? null,
      subscriptionBarberRule,
      barbershop: mapAuthBarbershop(result.shop),
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
        isAdmin: result.user.is_admin,
      },
    };
  } catch (e: any) {
    if (isPrismaUniqueError(e)) throw conflict("Slug/CNPJ já cadastrado");
    throw e;
  }
}

export async function registerClientService(params: {
  slug: string;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birthDate?: string | Date;
  password: string;
}) {
  const slug = params.slug.trim();
  const email = normalizeEmail(params.email);

  const shop = await findBarbershopBySlug(slug);
  if (!shop) throw notFound("Barbearia não encontrada");

  const existing = await findUserByEmailInBarbershop(shop.id, email);
  if (existing) throw conflict("E-mail já cadastrado nessa barbearia");

  const existingCpf = params.cpf ? await findUserByCpf(params.cpf) : null;
  if (existingCpf) throw conflict("CPF já cadastrado");

  const passwordHash = await bcrypt.hash(params.password, rounds());

  const user = await createUser({
    barbershopId: shop.id,
    name: params.name.trim(),
    email,
    cpf: params.cpf ?? null,
    phone: params.phone ?? null,
    birthDate: params.birthDate ?? null,
    role: "client",
    isAdmin: false,
    passwordHash,
  });

  sendWelcomeEmailAfterRegistration({
    to: user.email,
    name: user.name,
    barbershopName: shop.name,
  });

  const tokens = generateTokenPair({
    userId: user.id,
    barbershopId: shop.id,
    role: user.role as any,
    isAdmin: user.is_admin,
  });

  return {
    ...tokens,
    barbershop: mapAuthBarbershop(shop),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isAdmin: user.is_admin,
    },
  };
}

export async function listPublicBarbershopsService() {
  const shops = await listPublicBarbershops();
  return shops.map(mapAuthBarbershop);
}

export async function registerBarberService(params: {
  barbershopId: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  displayName?: string;
  specialty?: string;
  photoUrl?: string;
  commissionPercent?: number;
}) {
  const email = normalizeEmail(params.email);

  const existing = await findUserByEmailInBarbershop(params.barbershopId, email);
  if (existing) throw conflict("E-mail já cadastrado nessa barbearia");

  const passwordHash = await bcrypt.hash(params.password, rounds());

  const result = await prisma.$transaction(async (tx) => {
    const user = await createUser(
      {
        barbershopId: params.barbershopId,
        name: params.name.trim(),
        email,
        phone: params.phone ?? null,
        role: "barber",
        isAdmin: false,
        passwordHash,
      },
      tx
    );

    const barber = await createBarberProfile(
      {
        barbershopId: params.barbershopId,
        userId: user.id,
        displayName: (params.displayName?.trim() || params.name).trim(),
        specialty: params.specialty ?? null,
        photoUrl: params.photoUrl ?? null,
        commissionPercent: params.commissionPercent ?? null,
      },
      tx
    );

    return { user, barber };
  });

  const shop = await prisma.barbershops.findUnique({ where: { id: params.barbershopId }, select: { name: true } });
  sendWelcomeEmailAfterRegistration({
    to: result.user.email,
    name: result.user.name,
    barbershopName: shop?.name,
  });

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      role: result.user.role,
      isAdmin: result.user.is_admin,
    },
    barber: {
      id: result.barber.id,
      displayName: result.barber.display_name,
      specialty: result.barber.specialty,
      photoUrl: result.barber.photo_url,
      commissionPercent: result.barber.commission_percent,
    },
  };
}

export async function registerSuperAdminService(params: {
  setupKey: string;
  name: string;
  email: string;
  password: string;
}) {
  const expectedSetupKey = String(process.env.SUPER_ADMIN_SETUP_KEY || "").trim();
  if (!expectedSetupKey) {
    throw forbidden("Cadastro de super admin desabilitado no servidor");
  }

  if (params.setupKey.trim() !== expectedSetupKey) {
    throw forbidden("Chave de setup inválida");
  }

  const email = normalizeEmail(params.email);
  const existing = await findUserByEmail(email);
  if (existing) throw conflict("E-mail já cadastrado");

  const passwordHash = await bcrypt.hash(params.password, rounds());

  const user = await prisma.users.create({
    data: {
      name: params.name.trim(),
      email,
      role: "super_admin",
      is_admin: true,
      password_hash: passwordHash,
      current_barbershop_id: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      is_admin: true,
    },
  });

  sendWelcomeEmailAfterRegistration({
    to: user.email,
    name: user.name,
  });

  const token = signToken({
    userId: user.id,
    barbershopId: null,
    role: user.role as any,
    isAdmin: user.is_admin,
  });

  return {
    token,
    barbershop: null,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isAdmin: user.is_admin,
    },
  };
}

/* ─────────────── GET /auth/me ─────────────── */
export async function meService(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw notFound("Usuário não encontrado");

  const activeSubscription = user.subscriptions[0] ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf,
    role: user.role,
    isAdmin: user.is_admin,
    permissions: user.permissions,
    photoUrl: user.photo_url,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    barbershop: mapAuthBarbershop(user.barbershops),
    barberProfile: user.barbers ?? null,
    subscription: activeSubscription
      ? {
        id: activeSubscription.id,
        status: activeSubscription.status,
        startedAt: activeSubscription.started_at,
        nextBillingAt: activeSubscription.next_billing_at,
        monthlyBarberId: activeSubscription.monthly_barber_id,
        plan: activeSubscription.subscription_plans,
      }
      : null,
  };
}

/* ─────────────── POST /auth/refresh ─────────────── */
export async function refreshTokenService(refreshToken: string) {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized("Refresh token inválido ou expirado");
  }

  // garante que o user ainda existe
  const user = await findUserById(payload.userId);
  if (!user) throw unauthorized("Usuário não encontrado");

  const isSuperAdmin = String(user.role) === "super_admin";
  if (!isSuperAdmin && !user.current_barbershop_id) {
    throw unauthorized("Usuário sem barbearia ativa");
  }

  const tokenPayload = {
    userId: user.id,
    barbershopId: user.current_barbershop_id ?? null,
    role: user.role as "admin" | "barber" | "client" | "receptionist" | "super_admin",
    isAdmin: user.is_admin,
  };

  return generateTokenPair(tokenPayload);
}

export async function switchBarbershopService(params: {
  userId: string;
  barbershopId: string;
}) {
  const targetBarbershopId = String(params.barbershopId || "").trim();
  if (!targetBarbershopId) {
    throw forbidden("Barbearia inválida");
  }

  const user = await findUserById(params.userId);
  if (!user) {
    throw notFound("Usuário não encontrado");
  }

  const isSuperAdmin = String(user.role) === "super_admin";
  if (!isSuperAdmin) {
    const hasAccess = await prisma.users.findFirst({
      where: {
        id: params.userId,
        user_barbershops: {
          some: {
            barbershop_id: targetBarbershopId,
          },
        },
      },
      select: { id: true },
    });

    if (!hasAccess) {
      throw forbidden("Usuário sem acesso a esta barbearia");
    }
  }

  await prisma.users.update({
    where: { id: params.userId },
    data: { current_barbershop_id: targetBarbershopId },
  });

  const updatedUser = await findUserById(params.userId);
  if (!updatedUser) {
    throw notFound("Usuário não encontrado");
  }

  const token = signToken({
    userId: updatedUser.id,
    barbershopId: targetBarbershopId,
    role: updatedUser.role as any,
    isAdmin: updatedUser.is_admin,
  });

  const refreshToken = signRefreshToken({
    userId: updatedUser.id,
    barbershopId: targetBarbershopId,
    role: updatedUser.role as any,
    isAdmin: updatedUser.is_admin,
  });

  return {
    token,
    refreshToken,
    barbershop: mapAuthBarbershop(updatedUser.barbershops),
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      isAdmin: updatedUser.is_admin,
      permissions: updatedUser.permissions,
      photoUrl: updatedUser.photo_url,
    },
  };
}

export async function forgotPasswordService(params: { email: string }) {
  const email = normalizeEmail(params.email);
  if (!email) {
    throw badRequest("E-mail é obrigatório");
  }

  // Busca o usuário pelo e-mail
  const user = await prisma.users.findFirst({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  // Se o usuário não existir, retornamos sucesso genérico por segurança
  if (!user || !user.email) {
    return { message: "Se o e-mail estiver cadastrado, um link de recuperação será enviado." };
  }

  // Gera o token de reset (1 hora)
  const resetToken = signResetToken({ userId: user.id });

  // Constrói o link de reset
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Envia o e-mail
  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink,
    });
  } catch (error) {
    console.error("[ForgotPassword] Erro ao enviar e-mail:", error);
    throw serviceUnavailable("O serviço de e-mail está temporariamente indisponível. Tente novamente mais tarde.");
  }

  return { message: "Se o e-mail estiver cadastrado, um link de recuperação será enviado." };
}

export async function resetPasswordService(params: { token: string; password: string }) {
  if (!params.token || !params.password) {
    throw badRequest("Token e senha são obrigatórios");
  }

  if (params.password.length < 4) {
    throw badRequest("A senha deve ter no mínimo 4 caracteres");
  }

  let decoded;
  try {
    decoded = verifyResetToken(params.token);
  } catch (error) {
    throw unauthorized("Token de recuperação inválido ou expirado");
  }

  const passwordHash = await bcrypt.hash(params.password, rounds());

  await prisma.users.update({
    where: { id: decoded.userId },
    data: { password_hash: passwordHash, updated_at: new Date() },
  });

  return { message: "Senha alterada com sucesso." };
}
