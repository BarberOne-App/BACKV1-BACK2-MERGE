import bcrypt from "bcrypt";
import { conflict, forbidden, notFound } from "../errors/index.js";
import prisma from "../database/database.js";
import { sendWelcomeEmail } from "./emailService.js";
// import { ensureCanAddRole } from "./planLimitService.js";
import {
  cpfExistsForOtherUser,
  createUserInBarbershop,
  deleteUserFromBarbershop,
  emailExistsInBarbershop,
  findUserByIdInBarbershop,
  listUsersInBarbershop,
  updateUserInBarbershop,
  updateUserPermissions,
  phoneExistsForOtherUser,
} from "../repository/userRepository.js";
import { normalizePhone } from "../utils/phone.js";

function rounds() {
  return Number(process.env.BCRYPT_SALT_ROUNDS || 10);
}

function sendWelcomeEmailAfterUserCreation(params: {
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

function serializeUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    cpf: u.cpf,
    birthDate: u.birth_date ?? null,
    birth_date: u.birth_date ?? null,
    role: u.role,
    isAdmin: u.is_admin,
    permissions: u.permissions,
    photoUrl: u.photo_url,
    salary: u.salary ?? null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    barbershopId: u.current_barbershop_id,
    visits: u._count?.appointments ?? 0,
    lastVisit: u.appointments?.[0]?.start_at ?? null,
    lastAppointmentStatus: u.appointments?.[0]?.status ?? null,
    barberProfile: u.barbers ?? null,
  };
}

function normalizeEmail(email?: string | null) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value?: string | null) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function normalizeDigits(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

async function assertPhoneAvailable(phone?: string | null, excludeUserId?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const exists = await phoneExistsForOtherUser(normalizedPhone, excludeUserId);
  if (exists) {
    throw conflict("Telefone ja cadastrado em outro usuario");
  }

  return normalizedPhone;
}

function isAdminRow(row: {
  role?: string;
  isAdmin?: boolean;
}) {
  return row.isAdmin === true || row.role === "admin";
}

function buildImportSummary(params: {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  duplicateEmailCount: number;
  duplicateCpfCount: number;
  missingRequiredCount: number;
}) {
  const {
    createdCount,
    skippedCount,
    failedCount,
    duplicateEmailCount,
    duplicateCpfCount,
    missingRequiredCount,
  } = params;

  if (createdCount > 0 && failedCount === 0 && skippedCount === 0) {
    return "Importação concluída com sucesso.";
  }

  const parts: string[] = [];

  if (createdCount > 0) {
    parts.push(
      `${createdCount} usuário${createdCount > 1 ? "s importados" : " importado"}`
    );
  }

  if (skippedCount > 0) {
    parts.push(
      `${skippedCount} linha${skippedCount > 1 ? "s ignoradas" : " ignorada"}`
    );
  }

  if (failedCount > 0) {
    parts.push(
      `${failedCount} linha${failedCount > 1 ? "s rejeitadas" : " rejeitada"}`
    );
  }

  const reasons: string[] = [];

  if (duplicateEmailCount > 0) {
    reasons.push(
      `${duplicateEmailCount} e-mail${duplicateEmailCount > 1 ? "s duplicados" : " duplicado"}`
    );
  }

  if (duplicateCpfCount > 0) {
    reasons.push(
      `${duplicateCpfCount} CPF${duplicateCpfCount > 1 ? "s duplicados" : " duplicado"}`
    );
  }

  if (missingRequiredCount > 0) {
    reasons.push(
      `${missingRequiredCount} linha${missingRequiredCount > 1 ? "s com campos obrigatórios ausentes" : " com campos obrigatórios ausentes"}`
    );
  }

  if (!parts.length && reasons.length) {
    return `A planilha não pôde ser importada: ${reasons.join(", ")}.`;
  }

  if (parts.length && reasons.length) {
    return `Importação concluída parcialmente: ${parts.join(", ")}. Motivos principais: ${reasons.join(", ")}.`;
  }

  if (parts.length) {
    return `Importação concluída: ${parts.join(", ")}.`;
  }

  return "Nenhum usuário foi importado.";
}

/* ── LIST ── */
export async function listUsersService(params: {
  barbershopId: string;
  actorRole: string;
  query: { role?: string; excludeRole?: string; q?: string; page?: number; limit?: number };
}) {
  if (
    params.actorRole !== "admin" &&
    params.actorRole !== "receptionist" &&
    params.actorRole !== "barber"
  ) {
    throw forbidden("Sem permissão para listar usuários");
  }

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 500;

  const { items, total } = await listUsersInBarbershop({
    barbershopId: params.barbershopId,
    role: params.query.role,
    excludeRole: params.query.excludeRole,
    q: params.query.q?.trim(),
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map(serializeUser),
  };
}

/* ── GET BY ID ── */
export async function getUserByIdService(params: {
  barbershopId: string;
  userId: string;
}) {
  const user = await findUserByIdInBarbershop(params.barbershopId, params.userId);
  if (!user) throw notFound("Usuário não encontrado");
  return serializeUser(user);
}

/* ── CHECK EMAIL ── */
export async function checkEmailService(params: {
  barbershopId: string;
  email: string;
}) {
  const exists = await emailExistsInBarbershop(
    params.barbershopId,
    params.email.trim().toLowerCase()
  );
  return { exists };
}

/* ── CREATE ── */
export async function createUserService(params: {
  barbershopId: string;
  actorRole: string;
  data: {
    name: string;
    email: string;
    phone?: string | null;
    cpf?: string | null;
    birthDate?: string | null;
    password: string;
    role: string;
    isAdmin?: boolean;
    permissions?: Record<string, boolean>;
    photoUrl?: string | null;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode criar usuários");
  }

  const email = normalizeEmail(params.data.email);

  const exists = await emailExistsInBarbershop(params.barbershopId, email);
  if (exists) throw conflict("E-mail já cadastrado nessa barbearia");

  const passwordHash = await bcrypt.hash(params.data.password, rounds());

  // // valida limites de plano por role
  // if (params.data.role === "barber") {
  //   await ensureCanAddRole(params.barbershopId, "barber", 1);
  // }
  // if (params.data.role === "receptionist") {
  //   await ensureCanAddRole(params.barbershopId, "receptionist", 1);
  // }
  // if (params.data.isAdmin === true || params.data.role === "admin") {
  //   await ensureCanAddRole(params.barbershopId, "admin", 1);
  // }

  const defaultReceptionistPermissions: Record<string, boolean> = {
    manageAgendamentos: true,
    manageOffScheduleAppointments: true,
    manageSettings: true,
  };

  const resolvedPermissions =
    params.data.role === "receptionist"
      ? { ...defaultReceptionistPermissions, ...(params.data.permissions ?? {}) }
      : (params.data.permissions ?? undefined);

  const phone = await assertPhoneAvailable(params.data.phone);

  const user = await createUserInBarbershop({
    barbershopId: params.barbershopId,
    name: params.data.name.trim(),
    email,
    phone,
    cpf: normalizeDigits(params.data.cpf),
    birthDate: params.data.birthDate ?? null,
    role: params.data.role,
    isAdmin: params.data.isAdmin ?? false,
    passwordHash,
    permissions: resolvedPermissions,
    photoUrl: params.data.photoUrl ?? null,
  });

  const shop = await prisma.barbershops.findUnique({
    where: { id: params.barbershopId },
    select: { name: true },
  });
  sendWelcomeEmailAfterUserCreation({
    to: user.email,
    name: user.name,
    barbershopName: shop?.name,
  });

  return serializeUser(user);
}

/* ── IMPORT ── */
export async function importUsersService(params: {
  barbershopId: string;
  actorRole: string;
  data: {
    defaultPassword?: string;
    skipExisting?: boolean;
    rows: Array<{
      name: string;
      email: string;
      phone?: string | null;
      cpf?: string | null;
      birthDate?: string | null;
      role?: string;
      isAdmin?: boolean;
      permissions?: Record<string, boolean>;
      photoUrl?: string | null;
    }>;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode importar usuários");
  }

  const defaultPassword = params.data.defaultPassword?.trim() || "123456";
  if (defaultPassword.length < 4) {
    throw conflict("A senha padrão deve ter no mínimo 4 caracteres");
  }

  const skipExisting = params.data.skipExisting !== false;
  const created: any[] = [];
  const errors: Array<{
    row: number;
    email?: string;
    cpf?: string;
    code:
      | "MISSING_REQUIRED_FIELDS"
      | "DUPLICATE_EMAIL_IN_FILE"
      | "DUPLICATE_CPF_IN_FILE"
      | "EMAIL_ALREADY_EXISTS"
      | "CPF_ALREADY_EXISTS"
      | "CREATE_ERROR";
    message: string;
  }> = [];

  let skippedCount = 0;
  let duplicateEmailCount = 0;
  let duplicateCpfCount = 0;
  let missingRequiredCount = 0;

  const passwordHash = await bcrypt.hash(defaultPassword, rounds());
  const shop = await prisma.barbershops.findUnique({
    where: { id: params.barbershopId },
    select: { name: true },
  });

  const preparedRows = params.data.rows.map((row, index) => {
    const normalizedEmail = normalizeEmail(row.email);
    const normalizedCpf = normalizeDigits(row.cpf);
    const normalizedPhone = normalizeDigits(row.phone);
    const normalizedName = String(row.name || "").trim();

    return {
      rowIndex: index + 1,
      original: row,
      normalized: {
        name: normalizedName,
        email: normalizedEmail,
        cpf: normalizedCpf,
        phone: normalizedPhone,
        birthDate: row.birthDate ?? null,
        role: row.role || "client",
        isAdmin: row.isAdmin ?? false,
        permissions: row.permissions,
        photoUrl: row.photoUrl ?? null,
      },
    };
  });

  const emailOccurrences = new Map<string, number>();
  const cpfOccurrences = new Map<string, number>();
  const phoneOccurrences = new Map<string, number>();

  for (const item of preparedRows) {
    if (item.normalized.email) {
      emailOccurrences.set(
        item.normalized.email,
        (emailOccurrences.get(item.normalized.email) || 0) + 1
      );
    }

    if (item.normalized.cpf) {
      cpfOccurrences.set(
        item.normalized.cpf,
        (cpfOccurrences.get(item.normalized.cpf) || 0) + 1
      );
    }

    if (item.normalized.phone) {
      phoneOccurrences.set(
        item.normalized.phone,
        (phoneOccurrences.get(item.normalized.phone) || 0) + 1
      );
    }
  }

  for (const item of preparedRows) {
    const { rowIndex, normalized } = item;
    const rowIsAdmin = isAdminRow({
      role: normalized.role,
      isAdmin: normalized.isAdmin,
    });

    const missingFields: string[] = [];

    if (!normalized.name) missingFields.push("nome");
    if (!normalized.email) missingFields.push("e-mail");

    if (!rowIsAdmin) {
      if (!normalized.phone) missingFields.push("telefone");
      if (!normalized.cpf) missingFields.push("CPF");
    }

    if (missingFields.length > 0) {
      missingRequiredCount += 1;
      errors.push({
        row: rowIndex,
        email: normalized.email || undefined,
        cpf: normalized.cpf || undefined,
        code: "MISSING_REQUIRED_FIELDS",
        message: `Campos obrigatórios não preenchidos: ${missingFields.join(", ")}`,
      });
      continue;
    }

    if (normalized.email && (emailOccurrences.get(normalized.email) || 0) > 1) {
      duplicateEmailCount += 1;
      errors.push({
        row: rowIndex,
        email: normalized.email,
        cpf: normalized.cpf || undefined,
        code: "DUPLICATE_EMAIL_IN_FILE",
        message: "E-mail duplicado na planilha",
      });
      continue;
    }

    if (!rowIsAdmin && normalized.cpf && (cpfOccurrences.get(normalized.cpf) || 0) > 1) {
      duplicateCpfCount += 1;
      errors.push({
        row: rowIndex,
        email: normalized.email,
        cpf: normalized.cpf,
        code: "DUPLICATE_CPF_IN_FILE",
        message: "CPF duplicado na planilha",
      });
      continue;
    }

    if (normalized.phone && (phoneOccurrences.get(normalized.phone) || 0) > 1) {
      errors.push({
        row: rowIndex,
        email: normalized.email,
        cpf: normalized.cpf || undefined,
        code: "CREATE_ERROR",
        message: "Telefone duplicado na planilha",
      });
      continue;
    }

    try {
      if (normalized.phone) {
        await assertPhoneAvailable(normalized.phone);
      }

      const emailExists = await emailExistsInBarbershop(
        params.barbershopId,
        normalized.email
      );

      if (emailExists) {
        if (skipExisting) {
          skippedCount += 1;
          continue;
        }

        errors.push({
          row: rowIndex,
          email: normalized.email,
          cpf: normalized.cpf || undefined,
          code: "EMAIL_ALREADY_EXISTS",
          message: "E-mail já cadastrado nessa barbearia",
        });
        continue;
      }

      // // Antes de criar na importação, valida limites do plano
      // if (!rowIsAdmin) {
      //   if (normalized.role === "barber") {
      //     await ensureCanAddRole(params.barbershopId, "barber", 1);
      //   }
      //   if (normalized.role === "receptionist") {
      //     await ensureCanAddRole(params.barbershopId, "receptionist", 1);
      //   }
      // } else {
      //   if (normalized.isAdmin === true || normalized.role === "admin") {
      //     await ensureCanAddRole(params.barbershopId, "admin", 1);
      //   }
      // }

      const user = await createUserInBarbershop({
        barbershopId: params.barbershopId,
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        cpf: normalized.cpf,
        birthDate: normalized.birthDate,
        role: normalized.role,
        isAdmin: normalized.isAdmin,
        passwordHash,
        permissions: normalized.permissions,
        photoUrl: normalized.photoUrl,
      });

      sendWelcomeEmailAfterUserCreation({
        to: user.email,
        name: user.name,
        barbershopName: shop?.name,
      });

      created.push(serializeUser(user));
    } catch (error: any) {
      const rawMessage = String(error?.message || "");

      let code:
        | "CPF_ALREADY_EXISTS"
        | "CREATE_ERROR" = "CREATE_ERROR";

      let message = "Erro ao criar usuário";

      if (
        rawMessage.toLowerCase().includes("cpf") &&
        (
          rawMessage.toLowerCase().includes("unique") ||
          rawMessage.toLowerCase().includes("duplic") ||
          rawMessage.toLowerCase().includes("constraint")
        )
      ) {
        code = "CPF_ALREADY_EXISTS";
        message = "CPF já cadastrado";
      } else if (
        rawMessage.toLowerCase().includes("email") &&
        (
          rawMessage.toLowerCase().includes("unique") ||
          rawMessage.toLowerCase().includes("duplic") ||
          rawMessage.toLowerCase().includes("constraint")
        )
      ) {
        message = "E-mail já cadastrado";
      } else if (rawMessage.trim()) {
        message = rawMessage;
      }

      errors.push({
        row: rowIndex,
        email: normalized.email,
        cpf: normalized.cpf || undefined,
        code,
        message,
      });
    }
  }

  const createdCount = created.length;
  const failedCount = errors.length;

  const summary = buildImportSummary({
    createdCount,
    skippedCount,
    failedCount,
    duplicateEmailCount,
    duplicateCpfCount,
    missingRequiredCount,
  });

  return {
    success: failedCount === 0,
    message: summary,
    summary,
    createdCount,
    skippedCount,
    failedCount,
    defaultPasswordApplied: defaultPassword,
    created,
    errors,
  };
}

/* ── UPDATE ── */
export async function updateUserService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  userId: string;
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    cpf?: string | null;
    birthDate?: string | null;
    role?: string;
    isAdmin?: boolean;
    photoUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
    resetPassword?: string;
  };
}) {
  if (params.actorRole !== "admin" && params.actorId !== params.userId) {
    throw forbidden("Sem permissão para editar este usuário");
  }

  if (params.actorRole !== "admin") {
    delete params.data.role;
    delete params.data.isAdmin;
  }

  const current = await findUserByIdInBarbershop(params.barbershopId, params.userId);
  if (!current) throw notFound("Usuário não encontrado");

  const updateData: any = {};

  if (params.data.name !== undefined) updateData.name = params.data.name.trim();

  if (params.data.email !== undefined) {
    const email = params.data.email.trim().toLowerCase();
    const exists = await emailExistsInBarbershop(params.barbershopId, email);

    if (exists && current.email !== email) {
      throw conflict("E-mail já cadastrado nessa barbearia");
    }

    updateData.email = email;
  }

  if (params.data.phone !== undefined) {
    updateData.phone = await assertPhoneAvailable(params.data.phone, params.userId);
  }

  if (params.data.cpf !== undefined) {
    if (params.data.cpf !== null) {
      const cpfTaken = await cpfExistsForOtherUser(params.data.cpf, params.userId);
      if (cpfTaken) throw conflict("CPF já cadastrado");
    }
    updateData.cpf = params.data.cpf ?? null;
  }
  if (params.data.birthDate !== undefined) {
    updateData.birth_date = params.data.birthDate ? new Date(params.data.birthDate) : null;
  }
  if (params.data.role !== undefined) updateData.role = params.data.role;
  if (params.data.isAdmin !== undefined) updateData.is_admin = params.data.isAdmin;
  if (params.data.photoUrl !== undefined) updateData.photo_url = params.data.photoUrl ?? null;
  if ((params.data as any).salary !== undefined) updateData.salary = (params.data as any).salary ?? null;

  if (params.data.resetPassword) {
    if (!params.data.newPassword) {
      throw conflict("Informe a nova senha");
    }

    updateData.password_hash = await bcrypt.hash(params.data.newPassword, rounds());
  } else if (params.data.currentPassword || params.data.newPassword) {
    if (!params.data.currentPassword || !params.data.newPassword) {
      throw conflict("Informe a senha atual e a nova senha");
    }

    const passwordOk = await bcrypt.compare(
      params.data.currentPassword,
      current.password_hash
    );

    if (!passwordOk) {
      throw forbidden("Senha atual incorreta");
    }

    updateData.password_hash = await bcrypt.hash(params.data.newPassword, rounds());
  }

  const updated = await updateUserInBarbershop(
    params.barbershopId,
    params.userId,
    updateData
  );

  if (!updated) throw notFound("Usuário não encontrado");

  return serializeUser(updated);
}

/* ── UPDATE PERMISSIONS ── */
export async function updatePermissionsService(params: {
  barbershopId: string;
  actorRole: string;
  userId: string;
  permissions: Record<string, boolean>;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode alterar permissões");
  }

  const updated = await updateUserPermissions(
    params.barbershopId,
    params.userId,
    params.permissions
  );
  if (!updated) throw notFound("Usuário não encontrado");

  return serializeUser(updated);
}

/* ── DELETE ── */
export async function deleteUserService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  userId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode remover usuários");
  }

  if (params.actorId === params.userId) {
    throw forbidden("Não é possível remover a própria conta");
  }

  const deleted = await deleteUserFromBarbershop(params.barbershopId, params.userId);
  if (!deleted) throw notFound("Usuário não encontrado");

  return { ok: true };
}
