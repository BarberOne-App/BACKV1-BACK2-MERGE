import prisma from "../database/database.js";
import { badRequest, forbidden, notFound } from "../errors/index.js";
import {
  cancelAppointmentInBarbershop,
  createAppointmentTx,
  findAppointmentByIdInBarbershop,
  getBarberAppointmentsForDate,
  getClientAppointmentsForDate,
  listAppointmentsInBarbershop,
  updateAppointmentInBarbershop,
} from "../repository/appointmentRepository.js";
import {
  findBarberByIdInBarbershop,
  findBarberByUserIdInBarbershop,
} from "../repository/barberRepository.js";
import { findBlockedDateByDate } from "../repository/blockedDateRepository.js";
import { createPaymentInBarbershop, syncPaymentStatusByAppointment } from "../repository/paymentRepository.js";
import { getHomeInfoByBarbershop, getSettingsByBarbershop } from "../repository/settingRepository.js";
import { findActiveSubscriptionByUser } from "../repository/subscriptionRepository.js";
import {
  calculateCommission,
  getCommissionPercentByType,
  resolveServiceCommissionType,
} from "./commissionService.js";
import {
  sendAppointmentConfirmedEmail,
  sendAppointmentReceiptEmail,
  sendNewAppointmentNotificationEmail,
} from "./emailService.js";

/* ─────────────────── helpers ─────────────────── */

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePlanFeatureText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  if (text.includes("::")) {
    const parts = text.split("::");
    const label = parts[parts.length - 1]?.trim();
    return label ? normalizeText(label) : null;
  }
  if (UUID_RE.test(text)) return null;
  return normalizeText(text);
}

function isServiceCoveredBySubscription(
  service: { serviceId: string; serviceName: string; coveredByPlan: boolean },
  activeSubscription: any
): boolean {
  if (activeSubscription?.subscription_plans?.subscription_plan_features) {
    const normServiceName = normalizeText(service.serviceName || "");
    const features = activeSubscription.subscription_plans.subscription_plan_features;
    return features.some((f: any) => {
      const normFeature = normalizePlanFeatureText(f.feature);
      return normFeature === normServiceName;
    });
  }

  return false;
}

function getServiceDurationMinutes(service: any): number {
  const raw = service?.duration ?? service?.durationMinutes ?? service?.duration_minutes;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;
const SCHEDULE_BLOCK_MINUTES = 5;

function roundUpToScheduleBlock(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return SCHEDULE_BLOCK_MINUTES;
  }

  return Math.ceil(minutes / SCHEDULE_BLOCK_MINUTES) * SCHEDULE_BLOCK_MINUTES;
}

function getSaoPauloTimeParts(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [hourStr, minuteStr] = formatter.format(value).split(":");

  return {
    hour: Number(hourStr),
    minute: Number(minuteStr),
  };
}

function buildSaoPauloDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}

function serializeClientSubscription(a: any) {
  const subscriptions = Array.isArray(a.users?.subscriptions) ? a.users.subscriptions : [];
  const sameBarbershopSubscriptions = subscriptions.filter(
    (sub: any) => String(sub.barbershop_id) === String(a.barbershop_id),
  );

  const selected =
    sameBarbershopSubscriptions.find((sub: any) => sub.status === "active" || sub.status === "paused") ??
    sameBarbershopSubscriptions[0] ??
    null;

  if (!selected) return null;

  return {
    id: selected.id,
    status: selected.status,
    daysOverdue: Number(selected.days_overdue ?? 0),
    nextBillingAt: selected.next_billing_at ?? null,
    plan: selected.subscription_plans
      ? {
        id: selected.subscription_plans.id,
        name: selected.subscription_plans.name,
      }
      : null,
  };
}

function serializeAppointment(a: any) {
  const barberCommissionPercent =
    a.barbers?.commission_percent != null
      ? decimalToNumber(a.barbers.commission_percent)
      : null;

  const services = (a.appointment_services ?? []).map((s: any) => {
    const unitPrice = decimalToNumber(s.unit_price);
    const quantity = Number(s.quantity ?? 1);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const totalPrice = unitPrice * safeQuantity;
    const dbCommissionPercent =
      s.services?.comission_percent ?? s.services?.commission_percent;
    const rawCommissionPercent =
      dbCommissionPercent == null ? null : decimalToNumber(dbCommissionPercent);
    // Prioridade: % do serviço → % do barbeiro → padrão do tipo
    const effectiveCommissionPercent = rawCommissionPercent ?? barberCommissionPercent;
    const commissionType = resolveServiceCommissionType({
      coveredByPlan: s.services?.covered_by_plan,
      commissionPercent: effectiveCommissionPercent,
      serviceName: s.service_name,
    });
    const commissionAmount = calculateCommission({
      amount: totalPrice,
      type: commissionType,
      commissionPercent: effectiveCommissionPercent,
    });

    return {
      id: s.id,
      serviceId: s.service_id,
      serviceName: s.service_name,
      unitPrice,
      durationMinutes: s.duration_minutes,
      quantity: safeQuantity,
      totalPrice,
      commissionType,
      commissionPercent: effectiveCommissionPercent ?? getCommissionPercentByType(commissionType),
      commission_percent: effectiveCommissionPercent ?? getCommissionPercentByType(commissionType),
      commissionAmount,
    };
  });

  const products = (a.appointment_products ?? []).map((p: any) => {
    const unitPrice = decimalToNumber(p.unit_price);
    const quantity = Number(p.quantity ?? 1);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const discountPercent = Number(p.discount_percent ?? 0);
    const grossTotal = unitPrice * safeQuantity;
    const netTotal = grossTotal - grossTotal * (discountPercent / 100);

    return {
      id: p.id,
      productId: p.product_id,
      productName: p.product_name,
      unitPrice,
      discountPercent,
      quantity: safeQuantity,
      totalPrice: Math.round(netTotal * 100) / 100,
    };
  });

  const servicesTotal = services.reduce((sum: number, service: any) => sum + service.totalPrice, 0);
  const productsTotal = products.reduce((sum: number, product: any) => sum + product.totalPrice, 0);
  const commissionAmount = services.reduce(
    (sum: number, service: any) => sum + service.commissionAmount,
    0,
  );

  return {
    id: a.id,
    barberId: a.barber_id,
    clientId: a.client_id,
    dependentId: a.dependent_id ?? null,
    startAt: a.start_at,
    endAt: a.end_at,
    status: a.status,
    notes: a.notes,
    barbershopId: a.barbershop_id,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    barber: a.barbers
      ? {
        id: a.barbers.id,
        displayName: a.barbers.display_name,
        photoUrl: a.barbers.photo_url,
      }
      : null,
    client: a.users
      ? {
        id: a.users.id,
        name: a.users.name,
        email: a.users.email,
        phone: a.users.phone,
        subscription: serializeClientSubscription(a),
      }
      : null,
    dependent: a.dependents
      ? {
        id: a.dependents.id,
        name: a.dependents.name,
        age: a.dependents.age,
      }
      : null,
    services,
    products,
    servicesTotal: Math.round(servicesTotal * 100) / 100,
    productsTotal: Math.round(productsTotal * 100) / 100,
    totalAmount: Math.round((servicesTotal + productsTotal) * 100) / 100,
    commissionPercent:
      services.length === 1 ? services[0].commissionPercent : null,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    lastModifiedBy: a.last_modified_by ?? null,
    lastActionDescription: a.last_action_description ?? null,
  };
}

/* ── Horário de funcionamento padrão ── */

const OPEN_HOUR = 9;
const CLOSE_HOUR = 20;
const SLOT_STEP = 5;
const SCHEDULE_PLACEHOLDERS = new Set([
  "Ex: Horário de Funcionamento",
  "Ex: Seg - 14h as 20h",
  "Ex: Terça a Sab. - 09h as 20h",
  "Ex: Domingo: Fechado",
]);



function isRealScheduleLine(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return Boolean(trimmed && !SCHEDULE_PLACEHOLDERS.has(trimmed));
}

function parseTimeToMinutes(raw: string) {
  const value = normalizeText(raw).replace(/\s+/g, "");
  const match = value.match(/^(\d{1,2})(?::?(\d{2}))?h?$/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function getSaoPauloNow() {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const todayStr = dateFormatter.format(now);
  const [hourStr, minuteStr] = timeFormatter.format(now).split(":");
  const nowMinutes = Number(hourStr) * 60 + Number(minuteStr);

  return { todayStr, nowMinutes };
}

function extractTimeRangeFromLine(line: string) {
  const normalized = normalizeText(line);
  const timeRegex = /(\d{1,2}(?::\d{2})?\s*h?)/g;
  const times = [...normalized.matchAll(timeRegex)]
    .map((m) => m[1])
    .filter(Boolean);

  if (times.length < 2) return null;

  const start = parseTimeToMinutes(times[0]);
  const end = parseTimeToMinutes(times[1]);

  if (start == null || end == null || end <= start) return null;

  return { start, end };
}

function dayTokenToWeekday(token: string): number | null {
  const t = normalizeText(token);

  if (t.startsWith("dom")) return 0;
  if (t.startsWith("seg")) return 1;
  if (t.startsWith("ter")) return 2;
  if (t.startsWith("qua")) return 3;
  if (t.startsWith("qui")) return 4;
  if (t.startsWith("sex")) return 5;
  if (t.startsWith("sab")) return 6;

  return null;
}

function lineAppliesToWeekday(line: string, weekday: number) {
  const normalized = normalizeText(line);
  const dayRegex =
    /(domingo|dom|segunda|seg|terca|ter|quarta|qua|quinta|qui|sexta|sex|sabado|sab)/g;

  const tokens = [...normalized.matchAll(dayRegex)].map((m) => m[1]);
  const days: number[] = [];

  for (const token of tokens) {
    const day = dayTokenToWeekday(token);
    if (day !== null) days.push(day);
  }

  if (days.length === 0) return true;

  if (days.length >= 2 && /(\sa\s|ate)/.test(normalized)) {
    const start = days[0]!;
    const end = days[1]!;

    if (start <= end) return weekday >= start && weekday <= end;

    return weekday >= start || weekday <= end;
  }

  return days.includes(weekday);
}

async function getOpeningWindowFromHomeInfo(barbershopId: string, date: string) {
  const row = await getHomeInfoByBarbershop(barbershopId);
  const target = new Date(`${date}T12:00:00`);
  const weekday = target.getUTCDay();

  const lines = [
    row?.schedule_line1,
    row?.schedule_line2,
    row?.schedule_line3,
  ].filter(isRealScheduleLine) as string[];

  for (const line of lines) {
    if (!lineAppliesToWeekday(line, weekday)) continue;

    const normalized = normalizeText(line);

    if (normalized.includes("fechado") || normalized.includes("closed")) {
      return null;
    }

    const range = extractTimeRangeFromLine(line);
    if (range) return range;
  }

  return { start: OPEN_HOUR * 60, end: CLOSE_HOUR * 60 };
}

function isCompletedStatus(status: string | undefined | null) {
  const normalized = normalizeText(String(status ?? ""));

  return [
    "completed",
    "complete",
    "finalizado",
    "finalizada",
    "concluido",
    "concluida",
    "finished",
    "done",
  ].includes(normalized);
}

function toValidDate(value: any): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveActorDisplayName(barbershopId: string, actorRole: string | undefined, actorId?: string | undefined) {
  if (!actorId) return "Usuário";

  if (actorRole === "barber") {
    const barber = await findBarberByUserIdInBarbershop(barbershopId, actorId);
    if (barber) return barber.display_name;
  }

  const user = await prisma.users.findUnique({ where: { id: actorId }, select: { name: true } });
  return user?.name ?? "Usuário";
}

function getSubscriptionRenewalDate(subscription: any): Date | null {
  const candidates = [
    subscription?.renewed_at,
    subscription?.renewal_date,
    subscription?.last_renewed_at,
    subscription?.last_payment_at,
    subscription?.paid_at,
    subscription?.current_period_start,
    subscription?.current_period_started_at,
    subscription?.billing_cycle_start,
    subscription?.updated_at,
  ];

  for (const candidate of candidates) {
    const parsed = toValidDate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function canChangeMonthlyBarber(subscription: any, appointmentStartAt: Date) {
  const currentMonthlyBarberId = subscription?.monthly_barber_id;
  const lockDate = toValidDate(subscription?.monthly_barber_set_at);

  if (!currentMonthlyBarberId || !lockDate) {
    return { allowed: true, reason: null as string | null };
  }

  if (appointmentStartAt.getTime() - lockDate.getTime() >= THIRTY_DAYS_IN_MS) {
    return { allowed: true, reason: null as string | null };
  }

  const renewalDate = getSubscriptionRenewalDate(subscription);

  if (renewalDate && renewalDate.getTime() > lockDate.getTime()) {
    return { allowed: true, reason: null as string | null };
  }

  return {
    allowed: false,
    reason:
      "Só é possível trocar de barbeiro após 30 dias da vinculação ou após a renovação do plano",
  };
}

function getSubscriptionBarberRule(settings: any): "fixed" | "free_choice" {
  return settings?.subscription_barber_rule === "free_choice" ? "free_choice" : "fixed";
}

function validateBarberCanPerformServices(
  barber: any,
  services: { serviceId?: string | null; serviceName?: string | null }[],
) {
  const allowedServiceIds = Array.isArray(barber?.barber_services)
    ? barber.barber_services.map((item: any) => String(item.service_id)).filter(Boolean)
    : [];

  // Barbers without explicit service restrictions keep legacy behavior.
  if (allowedServiceIds.length === 0) return;

  const allowed = new Set(allowedServiceIds);
  const missing = services.filter((service) => service.serviceId && !allowed.has(String(service.serviceId)));

  if (missing.length > 0) {
    const names = missing.map((service) => service.serviceName).filter(Boolean).join(", ");
    throw badRequest(
      names
        ? `O barbeiro selecionado não realiza: ${names}`
        : "O barbeiro selecionado não realiza um ou mais serviços solicitados",
    );
  }
}

async function getNormalizedAppointmentServices(params: {
  barbershopId: string;
  services: {
    id: string;
    name?: string;
    basePrice?: number;
    duration?: number;
    durationMinutes?: number;
    duration_minutes?: number;
    quantity?: number;
  }[];
}) {
  if (!Array.isArray(params.services) || params.services.length === 0) {
    throw badRequest("Selecione pelo menos um serviço");
  }

  const serviceIds = params.services.map((service) => service.id).filter(Boolean);

  if (serviceIds.length !== params.services.length) {
    throw badRequest("Um ou mais serviços selecionados são inválidos");
  }

  const dbServices = await prisma.services.findMany({
    where: {
      id: {
        in: serviceIds,
      },
      barbershop_id: params.barbershopId,
    },
  });

  if (dbServices.length !== new Set(serviceIds).size) {
    throw badRequest("Um ou mais serviços selecionados são inválidos");
  }

  const servicesById = new Map(dbServices.map((service: any) => [service.id, service]));

  return params.services.map((service) => {
    const dbService: any = servicesById.get(service.id);

    if (!dbService) {
      throw badRequest("Serviço inválido");
    }

    const quantity = Number(service.quantity ?? 1);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    return {
      serviceId: dbService.id,
      serviceName: dbService.name,
      unitPrice: decimalToNumber(dbService.base_price),
      durationMinutes: getServiceDurationMinutes(dbService),
      commissionPercent:
        dbService.comission_percent == null && dbService.commission_percent == null
          ? null
          : decimalToNumber(dbService.comission_percent ?? dbService.commission_percent),
      coveredByPlan: !!dbService.covered_by_plan,
      quantity: safeQuantity,
    };
  });
}

/* ─────────────────────────── LIST ─────────────────────────── */

export async function listAppointmentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  actorPermissions?: Record<string, boolean>;
  query: {
    barberId?: string;
    clientId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    allAppointments?: boolean | string;
  };
}) {
  const shouldReturnAll = String(params.query.allAppointments).toLowerCase() === "true";

  if (shouldReturnAll) {
    const page = params.query.page ?? 1;
    const limit = params.query.limit ?? 100;

    const { items, total } = await listAppointmentsInBarbershop({
      barbershopId: params.barbershopId,
      barberId: params.query.barberId,
      clientId: undefined,
      status: params.query.status,
      dateFrom: params.query.dateFrom,
      dateTo: params.query.dateTo,
      page,
      limit,
    });

    return {
      page,
      limit,
      total,
      items: items.map(serializeAppointment),
    };
  }

  let clientId = params.query.clientId;

  if (params.actorRole === "client") {
    clientId = params.actorId;
  }

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 100;

  const { items, total } = await listAppointmentsInBarbershop({
    barbershopId: params.barbershopId,
    barberId: params.query.barberId,
    clientId,
    status: params.query.status,
    dateFrom: params.query.dateFrom,
    dateTo: params.query.dateTo,
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map(serializeAppointment),
  };
}

/* ────────────────────────── GET BY ID ────────────────────────── */

export async function getAppointmentByIdService(params: {
  barbershopId: string;
  appointmentId: string;
}) {
  const appt = await findAppointmentByIdInBarbershop(
    params.barbershopId,
    params.appointmentId,
  );

  if (!appt) throw notFound("Agendamento não encontrado");

  return serializeAppointment(appt);
}

/* ────────────────────────── CREATE ────────────────────────── */

export async function createAppointmentService(params: {
  barbershopId: string;
  actorId?: string;
  actorRole?: string;
  actorIsAdmin?: boolean;
  actorPermissions?: Record<string, boolean>;
  data: {
    barberId: string;
    clientId: string;
    dependentId?: string | null;
    date: string;
    time: string;
    notes?: string | null;
    isOutOfHours?: boolean;
    allowOutsideBusinessHours?: boolean;
    services: {
      id: string;
      name?: string;
      basePrice?: number;
      duration?: number;
      durationMinutes?: number;
      duration_minutes?: number;
      quantity?: number;
    }[];
    products: {
      id: string;
      name: string;
      price: number;
      quantity?: number;
      discount?: number;
    }[];
  };
}) {
  const { barberId, clientId, dependentId, date, time, services, products } = params.data;

  const barber = await findBarberByIdInBarbershop(params.barbershopId, barberId);

  if (!barber) throw notFound("Barbeiro não encontrado");

  /* ── Valida datas bloqueadas (dia inteiro) ── */
  const blockedEntries = await findBlockedDateByDate(params.barbershopId, date, barberId);

  for (const block of blockedEntries) {
    const affectsBarber = !block.barber_id || block.barber_id === barberId;
    if (!affectsBarber) continue;

    if (!block.start_time || !block.end_time) {
      throw badRequest(
        block.barber_id
          ? "O barbeiro está indisponível neste dia"
          : "A barbearia está fechada neste dia"
      );
    }
  }

  const normalizedServices = await getNormalizedAppointmentServices({
    barbershopId: params.barbershopId,
    services,
  });

  validateBarberCanPerformServices(barber, normalizedServices);

  const totalDuration = normalizedServices.reduce(
    (sum, service) => sum + service.durationMinutes * service.quantity,
    0,
  );

  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw badRequest("Duração total dos serviços deve ser > 0");
  }

  const blockedDuration = roundUpToScheduleBlock(totalDuration);

  /* ── Valida datas bloqueadas (horário parcial) ── */
  const apptStartMin = parseTimeToMinutes(time);
  if (apptStartMin !== null) {
    const apptEndMin = apptStartMin + blockedDuration;
    for (const block of blockedEntries) {
      const affectsBarber = !block.barber_id || block.barber_id === barberId;
      if (!affectsBarber || !block.start_time || !block.end_time) continue;

      const blockStartMin = parseTimeToMinutes(block.start_time);
      const blockEndMin = parseTimeToMinutes(block.end_time);
      if (blockStartMin === null || blockEndMin === null) continue;

      if (apptStartMin < blockEndMin && apptEndMin > blockStartMin) {
        throw badRequest(
          block.barber_id
            ? `O barbeiro está bloqueado das ${block.start_time} às ${block.end_time}`
            : `A barbearia está bloqueada das ${block.start_time} às ${block.end_time}`
        );
      }
    }
  }

  const startAt = buildSaoPauloDateTime(date, time);

  if (Number.isNaN(startAt.getTime())) {
    throw badRequest("Data ou horário inválidos");
  }

  const endAt = new Date(startAt.getTime() + blockedDuration * 60_000);

  const startMinutes = parseTimeToMinutes(time);
  const { todayStr, nowMinutes } = getSaoPauloNow();

  const isPastDate = date < todayStr;
  const isPastTimeToday =
    date === todayStr && startMinutes != null && startMinutes <= nowMinutes;
  const isOutOfHoursAppointment = params.data.isOutOfHours === true || params.data.allowOutsideBusinessHours === true;
  const canCreateOutOfHoursAppointment =
    params.actorRole === "admin" || params.actorRole === "receptionist";

  if (isOutOfHoursAppointment && !canCreateOutOfHoursAppointment) {
    throw forbidden("Apenas admin ou recepcionista pode agendar fora do horário");
  }

  if (isOutOfHoursAppointment) {
    const openingWindow = await getOpeningWindowFromHomeInfo(params.barbershopId, date);
    const isOutsideWorkingHours =
      !openingWindow ||
      (startMinutes != null &&
        (startMinutes < openingWindow.start || startMinutes >= openingWindow.end));

    if (!isOutsideWorkingHours) {
      throw badRequest("Selecione um horário fora do expediente da barbearia");
    }
  }

  if (!isOutOfHoursAppointment && (isPastDate || isPastTimeToday)) {
    throw badRequest("Não é possível agendar no passado");
  }

  const [activeSubscription, barbershopSettings] = await Promise.all([
    findActiveSubscriptionByUser(params.barbershopId, clientId),
    getSettingsByBarbershop(params.barbershopId),
  ]);

  const isFitAppointment = String(params.data.notes || '').includes('[barberone:fit]');
  const isDependentAppointment = Boolean(dependentId);
  const activeSubscriptionForAppointment = isDependentAppointment ? null : activeSubscription;
  const subscriptionBarberRule = getSubscriptionBarberRule(barbershopSettings);
  const isFreeChoiceRule = subscriptionBarberRule === "free_choice";

  if (
    !isFitAppointment &&
    !isFreeChoiceRule &&
    activeSubscriptionForAppointment?.monthly_barber_id &&
    activeSubscriptionForAppointment.monthly_barber_id !== barberId
  ) {
    const barberChangeValidation = canChangeMonthlyBarber(activeSubscriptionForAppointment, startAt);

    if (!barberChangeValidation.allowed) {
      throw badRequest(barberChangeValidation.reason!);
    }
  }

  const existing = await getBarberAppointmentsForDate(
    params.barbershopId,
    barberId,
    date,
  );

  const hasConflict = existing.some((appt: any) => {
    const existStart = new Date(appt.start_at).getTime();
    const existEnd = new Date(appt.end_at).getTime();

    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();

    return newStart < existEnd && newEnd > existStart;
  });

  if (hasConflict) {
    throw badRequest(
      "Conflito de horário — barbeiro já possui agendamento neste período"
    );
  }

  const existingForClient = await getClientAppointmentsForDate({
    barbershopId: params.barbershopId,
    clientId,
    dependentId: dependentId ?? null,
    date,
  });

  const clientHasConflict = existingForClient.some((appt: any) => {
    const existStart = new Date(appt.start_at).getTime();
    const existEnd = new Date(appt.end_at).getTime();

    if (Number.isNaN(existStart) || Number.isNaN(existEnd)) {
      return false;
    }

    return startAt.getTime() < existEnd && endAt.getTime() > existStart;
  });

  if (clientHasConflict) {
    throw badRequest(
      "Cliente/dependente já possui agendamento neste horário"
    );
  }

  // const existing = await getBarberAppointmentsForDate(
  //   params.barbershopId,
  //   barberId,
  //   date,
  // );

  // const hasConflict = existing.some((appt: any) => {
  //   const existStart = new Date(appt.start_at).getTime();
  //   const existEnd = new Date(appt.end_at).getTime();

  //   const newStart = startAt.getTime();
  //   const newEnd = endAt.getTime();

  //   return newStart < existEnd && newEnd > existStart;
  // });

  // if (!isFitAppointment && hasConflict) {
  //   throw badRequest("Conflito de horário — barbeiro já possui agendamento neste período");
  // }

  // const existingForClient = await getClientAppointmentsForDate({
  //   barbershopId: params.barbershopId,
  //   clientId,
  //   dependentId: dependentId ?? null,
  //   date,
  // });

  // const clientHasConflict = existingForClient.some((appt: any) => {
  //   const existStart = new Date(appt.start_at).getTime();
  //   const existEnd = new Date(appt.end_at).getTime();

  //   if (Number.isNaN(existStart) || Number.isNaN(existEnd)) return false;

  //   return startAt.getTime() < existEnd && endAt.getTime() > existStart;
  // });

  // if (!isFitAppointment && clientHasConflict) {
  //   throw badRequest("Cliente/dependente já possui agendamento neste horário");
  // }

  const hasActiveSubscription = activeSubscriptionForAppointment && (
    activeSubscriptionForAppointment.status === "active" ||
    activeSubscriptionForAppointment.status === "paused"
  );
  const isSubscriptionAppointment = !!(
    hasActiveSubscription &&
    normalizedServices.every((s: any) => isServiceCoveredBySubscription(s, activeSubscriptionForAppointment))
  );

  if (hasActiveSubscription && !isSubscriptionAppointment) {
    throw badRequest("Servico nao coberto pelo plano ativo do assinante");
  }

  const appointmentStatus = "scheduled";

  const created = await createAppointmentTx({
    barbershopId: params.barbershopId,
    barberId,
    clientId,
    dependentId: dependentId ?? null,
    startAt,
    endAt,
    notes: params.data.notes,
    lastModifiedBy: params.actorId ?? null,
    lastActionDescription: `Agendado por ${await resolveActorDisplayName(params.barbershopId, params.actorRole, params.actorId)}`,
    status: appointmentStatus,
    services: normalizedServices,
    products: (products ?? []).map((product) => ({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      discountPercent: product.discount ?? 0,
      quantity: product.quantity ?? 1,
    })),
  });

  // Cria automaticamente o registro de pagamento para o agendamento
  const servicesTotal = normalizedServices.reduce(
    (sum, s) => sum + s.unitPrice * s.quantity,
    0,
  );
  const productsTotal = (products ?? []).reduce(
    (sum, p) => sum + p.price * (1 - (p.discount ?? 0) / 100) * (p.quantity ?? 1),
    0,
  );
  const totalAmount = servicesTotal + productsTotal;

  await createPaymentInBarbershop({
    barbershopId: params.barbershopId,
    userId: clientId,
    appointmentId: created.id,
    amount: totalAmount,
    method: isSubscriptionAppointment ? 'subscription' : 'local',
    status: 'pending',
  }).catch((err) => {
    console.error('[appointmentService] Falha ao criar registro de pagamento:', err);
  });

  if (
    !isFitAppointment &&
    !isFreeChoiceRule &&
    activeSubscriptionForAppointment &&
    activeSubscriptionForAppointment.monthly_barber_id !== barberId
  ) {
    await prisma.subscriptions.update({
      where: { id: activeSubscriptionForAppointment.id },
      data: {
        monthly_barber_id: barberId,
        monthly_barber_set_at: new Date(),
      },
    });
  }

  const serviceEmailItems = (created.appointment_services ?? []).map((item: any) => ({
    name: String(item.service_name || "Serviço"),
    quantity: Number(item.quantity || 1),
    unitPrice: decimalToNumber(item.unit_price),
  }));
  const productEmailItems = (created.appointment_products ?? []).map((item: any) => ({
    name: String(item.product_name || "Produto"),
    quantity: Number(item.quantity || 1),
    unitPrice: decimalToNumber(item.unit_price) * (1 - decimalToNumber(item.discount_percent) / 100),
  }));
  const emailJobs: Promise<void>[] = [];

  if (created.users?.email) {
    emailJobs.push(sendAppointmentReceiptEmail({
      to: created.users.email,
      appointmentId: created.id,
      clientName: created.users.name,
      dependentName: created.dependents?.name,
      barbershopName: created.barbershops.name,
      barberName: created.barbers?.display_name,
      startAt: created.start_at,
      services: serviceEmailItems,
      products: productEmailItems,
      totalAmount,
    }));
  }

  if (created.barbershops.email) {
    emailJobs.push(sendNewAppointmentNotificationEmail({
      to: created.barbershops.email,
      appointmentId: created.id,
      barbershopName: created.barbershops.name,
      clientName: created.users.name,
      clientEmail: created.users.email,
      clientPhone: created.users.phone,
      dependentName: created.dependents?.name,
      barberName: created.barbers?.display_name,
      startAt: created.start_at,
      serviceNames: serviceEmailItems.map((item: { name: string; }) => item.name),
      totalAmount,
    }));
  } else {
    console.warn(`[email] Barbearia ${created.barbershop_id} sem e-mail para notificação de agendamento.`);
  }

  if (emailJobs.length) {
    void Promise.allSettled(emailJobs).then((results) => {
      const failed = results.filter((result) => result.status === "rejected").length;
      if (failed) console.error(`[email] ${failed} envio(s) do agendamento ${created.id} falharam.`);
    });
  }

  return serializeAppointment(created);
}

/* ────────────────────────── UPDATE ────────────────────────── */

export async function updateAppointmentService(params: {
  barbershopId: string;
  actorRole: string;
  actorIsAdmin?: boolean;
  actorId: string;
  actorPermissions?: Record<string, boolean>;
  appointmentId: string;
  data: {
    status?: string;
    notes?: string;
    barberId?: string;
  };
}) {
  const isAdmin = params.actorRole === "admin" || !!params.actorIsAdmin;
  const isReceptionist = params.actorRole === "receptionist";

  const actorBarber = await findBarberByUserIdInBarbershop(
    params.barbershopId,
    params.actorId,
  );

  const existingAppointment = await findAppointmentByIdInBarbershop(
    params.barbershopId,
    params.appointmentId,
  );

  if (!existingAppointment) throw notFound("Agendamento não encontrado");

  const isOwnBarberAppointment =
    !!actorBarber && String(existingAppointment.barber_id) === String(actorBarber.id);

  if (!isAdmin && !isReceptionist && !isOwnBarberAppointment) {
    throw forbidden("Apenas admin, recepcionista ou o barbeiro do agendamento pode atualizar");
  }

  const updateData: any = {};

  if (params.data.status !== undefined) {
    const currentStatusIsCompleted = isCompletedStatus(existingAppointment.status);
    const nextStatusIsCompleted = isCompletedStatus(params.data.status);

    if (!currentStatusIsCompleted && nextStatusIsCompleted) {
      const appointmentStartAt = new Date(existingAppointment.start_at);

      if (Number.isNaN(appointmentStartAt.getTime())) {
        throw badRequest("Data do agendamento inválida para finalização");
      }

      const now = new Date();

      if (now.getTime() < appointmentStartAt.getTime()) {
        throw badRequest("Não é permitido finalizar antes da data e horário do agendamento");
      }
    }

    updateData.status = params.data.status;
  }

  if (params.data.notes !== undefined) {
    updateData.notes = params.data.notes;
  }

  if (params.data.barberId !== undefined) {
    const barber = await findBarberByIdInBarbershop(
      params.barbershopId,
      params.data.barberId,
    );

    if (!barber) throw notFound("Barbeiro não encontrado");

    validateBarberCanPerformServices(
      barber,
      existingAppointment.appointment_services.map((service: any) => ({
        serviceId: service.service_id,
        serviceName: service.service_name,
      })),
    );

    const appointmentClientId = existingAppointment.client_id;

    if (appointmentClientId && params.data.barberId !== existingAppointment.barber_id) {
      const [activeSubscription, barbershopSettings] = await Promise.all([
        findActiveSubscriptionByUser(params.barbershopId, appointmentClientId),
        getSettingsByBarbershop(params.barbershopId),
      ]);
      const isFreeChoiceRule = getSubscriptionBarberRule(barbershopSettings) === "free_choice";

      if (
        !isFreeChoiceRule &&
        activeSubscription?.monthly_barber_id &&
        activeSubscription.monthly_barber_id !== params.data.barberId
      ) {
        const currentAppointmentStartAt =
          toValidDate(existingAppointment.start_at) ?? new Date();

        const barberChangeValidation = canChangeMonthlyBarber(
          activeSubscription,
          currentAppointmentStartAt,
        );

        if (!barberChangeValidation.allowed) {
          throw badRequest(barberChangeValidation.reason!);
        }
      }

      if (
        !isFreeChoiceRule &&
        activeSubscription &&
        activeSubscription.monthly_barber_id !== params.data.barberId
      ) {
        await prisma.subscriptions.update({
          where: { id: activeSubscription.id },
          data: {
            monthly_barber_id: params.data.barberId,
            monthly_barber_set_at: new Date(),
          },
        });
      }
    }

    updateData.barber_id = params.data.barberId;
  }

  const actorDisplay = await resolveActorDisplayName(params.barbershopId, params.actorRole, params.actorId);
  let actionDescription: string | null = null;

  if (params.data.status !== undefined) {
    const statusNormalized = String(params.data.status || "").toLowerCase();
    if (statusNormalized === "confirmed") {
      actionDescription = params.actorRole === "barber"
        ? `Barbeiro ${actorDisplay} confirmou`
        : `${actorDisplay} confirmou`;
    } else if (statusNormalized === "cancelled" || statusNormalized === "canceled") {
      actionDescription = `${actorDisplay} cancelou`;
    } else if (statusNormalized === "no_show") {
      actionDescription = `${actorDisplay} marcou como não compareceu`;
    } else {
      actionDescription = `${actorDisplay} alterou status para ${params.data.status}`;
    }
  } else if (params.data.barberId !== undefined) {
    const newBarber = await findBarberByIdInBarbershop(params.barbershopId, params.data.barberId!);
    actionDescription = `${actorDisplay} mudou barbeiro para ${newBarber?.display_name ?? params.data.barberId}`;
  } else if (params.data.notes !== undefined) {
    actionDescription = `${actorDisplay} atualizou observações`;
  } else {
    actionDescription = `${actorDisplay} atualizou agendamento`;
  }

  const updated = await updateAppointmentInBarbershop(
    params.barbershopId,
    params.appointmentId,
    { ...updateData, last_modified_by: params.actorId, last_action_description: actionDescription },
  );

  if (!updated) throw notFound("Agendamento não encontrado");

  // Sincroniza o status do pagamento com o status do agendamento
  if (params.data.status) {
    const newStatus = String(params.data.status).toLowerCase();
    if (isCompletedStatus(newStatus)) {
      // Agendamento finalizado → pagamento pago
      syncPaymentStatusByAppointment(
        params.barbershopId,
        params.appointmentId,
        'paid',
        new Date(),
      ).catch(() => { });
    } else if (newStatus === 'cancelled' || newStatus === 'canceled' || newStatus === 'no_show') {
      // Agendamento cancelado/no-show → pagamento falhou
      syncPaymentStatusByAppointment(
        params.barbershopId,
        params.appointmentId,
        'failed',
        null,
      ).catch(() => { });
    }
  }

  const statusWillBeConfirmed = String(params.data.status || "").toLowerCase() === "confirmed";
  const wasAlreadyConfirmed = String(existingAppointment.status || "").toLowerCase() === "confirmed";
  const recipientEmail = updated.users?.email;

  if (statusWillBeConfirmed && !wasAlreadyConfirmed && recipientEmail) {
    const serviceNames = (updated.appointment_services ?? [])
      .map((service: any) => String(service.service_name || "").trim())
      .filter(Boolean);

    sendAppointmentConfirmedEmail({
      to: recipientEmail,
      clientName: updated.users?.name,
      dependentName: updated.dependents?.name,
      barberName: updated.barbers?.display_name,
      startAt: updated.start_at,
      serviceNames,
    }).catch((error) => {
      console.error("[email] Falha ao enviar e-mail de confirmação de agendamento:", error);
    });
  }

  return serializeAppointment(updated);
}

/* ────────────────────────── CANCEL (DELETE soft) ────────────────────────── */

export async function cancelAppointmentService(params: {
  barbershopId: string;
  appointmentId: string;
  actorRole: string;
  actorIsAdmin?: boolean;
  actorId: string;
  actorPermissions?: Record<string, boolean>;
}) {
  const appointment = await findAppointmentByIdInBarbershop(
    params.barbershopId,
    params.appointmentId,
  );

  if (!appointment) {
    throw notFound("Agendamento não encontrado");
  }

  if (normalizeText(appointment.status) === "cancelled") {
    throw badRequest("Este agendamento já está cancelado");
  }

  const isAdmin = params.actorRole === "admin" || !!params.actorIsAdmin;

  if (!isAdmin) {
    if (params.actorRole !== "client") {
      throw forbidden("Apenas admin pode cancelar este agendamento");
    }

    if (String(appointment.client_id) !== String(params.actorId)) {
      throw forbidden("Cliente sem permissão para cancelar este agendamento");
    }

    const appointmentStartAt = new Date(appointment.start_at);

    if (Number.isNaN(appointmentStartAt.getTime())) {
      throw badRequest("Data do agendamento inválida para cancelamento");
    }

    const minutesUntilAppointment =
      (appointmentStartAt.getTime() - Date.now()) / (60 * 1000);

    if (minutesUntilAppointment <= 15) {
      throw forbidden(
        "O cliente só pode cancelar até 15 minutos antes do horário do agendamento. Depois disso, somente o admin pode cancelar.",
      );
    }
  }

  const actorDisplay = await resolveActorDisplayName(params.barbershopId, params.actorRole, params.actorId);

  await prisma.$transaction(async (tx: any) => {
    const appointmentProducts = await tx.appointment_products.findMany({
      where: { appointment_id: params.appointmentId },
      select: { product_id: true, quantity: true },
    });

    for (const item of appointmentProducts) {
      if (!item.product_id) continue;

      const quantityToReturn = Number(item.quantity ?? 0);

      if (!Number.isFinite(quantityToReturn) || quantityToReturn <= 0) continue;

      await tx.products.updateMany({
        where: {
          id: item.product_id,
          barbershop_id: params.barbershopId,
        },
        data: { stock: { increment: quantityToReturn } },
      });
    }

    await tx.appointments.updateMany({
      where: {
        id: params.appointmentId,
        barbershop_id: params.barbershopId,
        status: { not: "cancelled" },
      },
      data: {
        status: "cancelled",
        updated_at: new Date(),
        last_modified_by: params.actorId,
        last_action_description: `${actorDisplay} cancelou`,
      },
    });
  });

  const cancelled = await findAppointmentByIdInBarbershop(
    params.barbershopId,
    params.appointmentId,
  );

  if (!cancelled) {
    throw notFound("Agendamento não encontrado");
  }

  return serializeAppointment(cancelled);
}

/* ────────────────────────── AVAILABLE SLOTS ────────────────────────── */

export async function getAvailableSlotsService(params: {
  barbershopId: string;
  barberId: string;
  date: string;
  duration: number;
}) {
  const barber = await findBarberByIdInBarbershop(params.barbershopId, params.barberId);

  if (!barber) throw notFound("Barbeiro não encontrado");

  const duration = Number(params.duration);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw badRequest("Duração inválida");
  }

  const blockedDuration = roundUpToScheduleBlock(duration);

  /* ── Verifica datas bloqueadas ── */
  const blockedSlotEntries = await findBlockedDateByDate(
    params.barbershopId,
    params.date,
    params.barberId,
  );

  for (const block of blockedSlotEntries) {
    const affectsBarber = !block.barber_id || block.barber_id === params.barberId;
    if (!affectsBarber) continue;
    // Bloqueio dia inteiro → nenhum slot disponível
    if (!block.start_time || !block.end_time) return [];
  }

  const appointments = await getBarberAppointmentsForDate(
    params.barbershopId,
    params.barberId,
    params.date,
  );

  const busy = appointments.map((appointment: { start_at: Date; end_at: Date; }) => {
    const start = getSaoPauloTimeParts(appointment.start_at);
    const end = getSaoPauloTimeParts(appointment.end_at);

    return {
      start: start.hour * 60 + start.minute,
      end: end.hour * 60 + end.minute,
    };
  });

  // Adiciona bloqueios parciais à lista de ocupados
  for (const block of blockedSlotEntries) {
    const affectsBarber = !block.barber_id || block.barber_id === params.barberId;
    if (!affectsBarber || !block.start_time || !block.end_time) continue;
    const blockStart = parseTimeToMinutes(block.start_time);
    const blockEnd = parseTimeToMinutes(block.end_time);
    if (blockStart !== null && blockEnd !== null) {
      busy.push({ start: blockStart, end: blockEnd });
    }
  }

  const openingWindow = await getOpeningWindowFromHomeInfo(
    params.barbershopId,
    params.date,
  );

  if (!openingWindow) return [];

  const openMin = openingWindow.start;
  const closeMin = openingWindow.end;
  const slots: string[] = [];

  for (
    let slotStart = openMin;
    slotStart + blockedDuration <= closeMin;
    slotStart += SLOT_STEP
  ) {
    const slotEnd = slotStart + blockedDuration;

    const collision = busy.some(
      (busySlot: { start: number; end: number; }) => slotStart < busySlot.end && slotEnd > busySlot.start,
    );

    if (!collision) {
      const hh = String(Math.floor(slotStart / 60)).padStart(2, "0");
      const mm = String(slotStart % 60).padStart(2, "0");

      slots.push(`${hh}:${mm}`);
    }
  }

  const { todayStr, nowMinutes } = getSaoPauloNow();

  if (params.date === todayStr) {
    return slots.filter((slot) => {
      const [hour, minute] = slot.split(":").map(Number);
      return hour * 60 + minute > nowMinutes;
    });
  }

  return slots;
}
