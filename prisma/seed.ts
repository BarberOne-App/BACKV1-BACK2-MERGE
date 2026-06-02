import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
// import fs from "node:fs";

const prisma = new PrismaClient();

const MOCK_FILE = "prisma/mock.json";

// você pode personalizar aqui
const DEFAULT_BARBERSHOP = {
  name: "BarberOne",
  slug: "barberone",
  phone: null as string | null,
  email: null as string | null,
  cnpj: null as string | null,
};

function normalizeUserRole(role: any, isAdmin?: boolean) {
  if (isAdmin) return "admin";
  const r = String(role ?? "").toLowerCase().trim();
  if (["admin", "barber", "client", "receptionist"].includes(r)) return r;
  return "client";
}

function normalizeAppointmentStatus(status: any) {
  const s = String(status ?? "").toLowerCase().trim();
  if (["scheduled", "completed", "cancelled", "no_show"].includes(s)) return s;
  if (s === "confirmed") return "scheduled";
  return "scheduled";
}

function normalizeSubscriptionStatus(status: any) {
  const s = String(status ?? "").toLowerCase().trim();
  if (["active", "paused", "cancelled", "expired"].includes(s)) return s;
  return "active";
}

function normalizePaymentMethod(method: any) {
  const m = String(method ?? "").toLowerCase().trim();
  if (["pix", "debito", "credito", "dinheiro", "local", "subscription"].includes(m)) return m;
  return "local";
}

function parseMoneyToDecimal(value: any): Prisma.Decimal {
  if (value == null) return new Prisma.Decimal("0.00");
  if (typeof value === "number") return new Prisma.Decimal(value.toFixed(2));

  let s = String(value).trim();

  // exemplos: "R$ 40,00" / "R$ 38.00" / "R$ 30" / "40" / "40,5"
  s = s.replace(/[R$\s]/g, "");
  // remove qualquer coisa não número/.,-
  s = s.replace(/[^0-9,.\-]/g, "");

  if (s.includes(",")) {
    // padrão BR: 1.234,56
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // padrão US: 1234.56 ou "30"
    // mantém o ponto como decimal
  }

  if (s === "" || s === "." || s === "-") return new Prisma.Decimal("0.00");
  const n = Number(s);
  if (Number.isNaN(n)) return new Prisma.Decimal("0.00");
  return new Prisma.Decimal(n.toFixed(2));
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  // assume horário local -03:00 (pra seed em BR)
  // ex: 2026-02-12 + 14:00 => 2026-02-12T14:00:00-03:00
  const iso = `${dateStr}T${timeStr}:00-03:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function toDateOnly(d: Date): Date {
  // converte pra YYYY-MM-DD (UTC midnight)
  return new Date(d.toISOString().slice(0, 10));
}

async function wipeAll() {
  console.log("🧹 Limpando tabelas (modo teste)...");
  await prisma.appointment_products.deleteMany();
  await prisma.appointment_services.deleteMany();
  await prisma.subscription_usages.deleteMany();
  await prisma.subscription_cycles.deleteMany();
  await prisma.payment_transactions.deleteMany();
  await prisma.appointments.deleteMany();
  await prisma.subscriptions.deleteMany();
  await prisma.user_payment_methods.deleteMany();
  await prisma.products.deleteMany();
  await prisma.services.deleteMany();
  await prisma.barbers.deleteMany();
  await prisma.users.deleteMany();
  await prisma.gallery_images.deleteMany();
  await prisma.subscription_plan_features.deleteMany();
  await prisma.subscription_plans.deleteMany();
  await prisma.barbershops.deleteMany();
}

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // if (!fs.existsSync(MOCK_FILE)) {
  //   throw new Error(`Arquivo de mock não encontrado: ${MOCK_FILE}`);
  // }

  const raw = MOCK_FILE;
  const data = JSON.parse(raw);

  // 1) apaga tudo (teste local)
  await wipeAll();

  // 2) cria barbearia
  const barbershop = await prisma.barbershops.upsert({
    where: { slug: DEFAULT_BARBERSHOP.slug },
    update: {
      name: DEFAULT_BARBERSHOP.name,
      phone: DEFAULT_BARBERSHOP.phone,
      email: DEFAULT_BARBERSHOP.email,
      cnpj: DEFAULT_BARBERSHOP.cnpj,
    },
    create: {
      name: DEFAULT_BARBERSHOP.name,
      slug: DEFAULT_BARBERSHOP.slug,
      phone: DEFAULT_BARBERSHOP.phone,
      email: DEFAULT_BARBERSHOP.email,
      cnpj: DEFAULT_BARBERSHOP.cnpj,
    },
  });

  const barbershopId = barbershop.id;

  // helpers de mapeamento legacy_id -> uuid real
  const userIdByLegacy = new Map<string, string>();
  const barberIdByLegacy = new Map<string, string>();
  const serviceIdByLegacy = new Map<string, string>();
  const serviceIdByName = new Map<string, string>();
  const productIdByLegacy = new Map<string, string>();
  const productIdByName = new Map<string, string>();
  const planIdByLegacy = new Map<string, string>();
  const subscriptionIdByLegacy = new Map<string, string>();
  const subscriptionCycleIdBySubscription = new Map<string, string>();
  const activeSubscriptionByUserLegacy = new Map<string, { subscriptionId: string; cycleId?: string }>();

  // 3) subscription plans
  const plans = Array.isArray(data.subscriptionPlans) ? data.subscriptionPlans : [];
  for (const p of plans) {
    const legacy = String(p.id);

    const plan = await prisma.subscription_plans.upsert({
      where: { legacy_id: legacy },
      update: {
        name: String(p.name ?? legacy),
        price: parseMoneyToDecimal(p.price),
        cuts_per_month: Number(p.cutsPerMonth ?? p.cuts_per_month ?? 0),
        active: Boolean(p.active ?? true),
      },
      create: {
        legacy_id: legacy,
        name: String(p.name ?? legacy),
        price: parseMoneyToDecimal(p.price),
        cuts_per_month: Number(p.cutsPerMonth ?? p.cuts_per_month ?? 0),
        active: Boolean(p.active ?? true),
      },
    });

    planIdByLegacy.set(legacy, plan.id);

    // features (remove e cria de novo)
    await prisma.subscription_plan_features.deleteMany({ where: { plan_id: plan.id } });
    const feats = Array.isArray(p.features) ? p.features : [];
    if (feats.length) {
      await prisma.subscription_plan_features.createMany({
        data: feats.map((f: any, idx: number) => ({
          plan_id: plan.id,
          feature: String(f),
          sort_order: idx,
        })),
      });
    }
  }

  // 4) users
  const users = Array.isArray(data.users) ? data.users : [];
  for (const u of users) {
    const legacy = String(u.id);
    const password = String(u.password ?? "123456");
    const password_hash = await bcrypt.hash(password, 10);

    const role = normalizeUserRole(u.role, u.isAdmin) as any;

    const user = await prisma.users.upsert({
      where: { legacy_id: legacy },
      update: {
        name: String(u.name ?? legacy),
        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        role,
        is_admin: Boolean(u.isAdmin ?? false),
        password_hash,
        current_barbershop: {
          connect: { id: barbershopId },
        },
        barbershop_links: {
          connectOrCreate: {
            where: { user_id_barbershop_id: { user_id: "", barbershop_id: barbershopId } },
            create: { barbershop_id: barbershopId },
          },
        },
      },
      create: {
        legacy_id: legacy,
        name: String(u.name ?? legacy),
        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        role,
        is_admin: Boolean(u.isAdmin ?? false),
        password_hash,
        current_barbershop: {
          connect: { id: barbershopId },
        },
        barbershop_links: {
          create: { barbershop_id: barbershopId },
        },
      },
    });

    userIdByLegacy.set(legacy, user.id);
  }

  // 5) barbers
  const barbers = Array.isArray(data.barbers) ? data.barbers : [];
  for (const b of barbers) {
    const legacy = String(b.id);
    const userLegacy = b.userId != null ? String(b.userId) : null;
    const userId = userLegacy ? userIdByLegacy.get(userLegacy) ?? null : null;

    const barber = await prisma.barbers.upsert({
      where: { legacy_id: legacy },
      update: {
        display_name: String(b.name ?? legacy),
        specialty: b.specialty ? String(b.specialty) : null,
        photo_url: b.photo ? String(b.photo) : null,
        commission_percent: b.commissionPercent != null ? Number(b.commissionPercent) : null,
        user_id: userId,
        barbershop_id: barbershopId,
      },
      create: {
        legacy_id: legacy,
        display_name: String(b.name ?? legacy),
        specialty: b.specialty ? String(b.specialty) : null,
        photo_url: b.photo ? String(b.photo) : null,
        commission_percent: b.commissionPercent != null ? Number(b.commissionPercent) : null,
        user_id: userId,
        barbershop_id: barbershopId,
      },
    });

    barberIdByLegacy.set(legacy, barber.id);
  }

  // 6) services
  const services = Array.isArray(data.services) ? data.services : [];
  for (const s of services) {
    const legacy = String(s.id);
    const service = await prisma.services.upsert({
      where: { legacy_id: legacy },
      update: {
        name: String(s.name ?? legacy),
        base_price: parseMoneyToDecimal(s.price),
        duration_minutes: Number(s.duration ?? s.durationMinutes ?? 0),
        image_url: s.image ? String(s.image) : null,
        active: true,
        barbershop_id: barbershopId,
      },
      create: {
        legacy_id: legacy,
        name: String(s.name ?? legacy),
        base_price: parseMoneyToDecimal(s.price),
        duration_minutes: Number(s.duration ?? s.durationMinutes ?? 0),
        image_url: s.image ? String(s.image) : null,
        active: true,
        barbershop_id: barbershopId,
      },
    });

    serviceIdByLegacy.set(legacy, service.id);
    serviceIdByName.set(service.name.toLowerCase(), service.id);
  }

  // 7) products (se não existir data.products, tenta montar pelos appointments.products)
  const productsFromTop = Array.isArray(data.products) ? data.products : [];
  const productsFromAppts: any[] = [];

  const apptsRaw = Array.isArray(data.appointments) ? data.appointments : [];
  for (const a of apptsRaw) {
    const prods = Array.isArray(a.products) ? a.products : [];
    for (const p of prods) productsFromAppts.push(p);
  }

  const productCandidates = productsFromTop.length ? productsFromTop : productsFromAppts;

  // dedup por id (se tiver) senão por name
  const seenProdKey = new Set<string>();
  for (const p of productCandidates) {
    const key = p?.id != null ? `id:${String(p.id)}` : `name:${String(p.name ?? "").toLowerCase()}`;
    if (!key || seenProdKey.has(key)) continue;
    seenProdKey.add(key);

    const legacy = p?.id != null ? String(p.id) : null;
    const name = String(p.name ?? legacy ?? "Produto");

    // se não tiver legacy_id, cria um "fake" estável pelo nome
    const legacySafe = legacy ?? `mock:${name.toLowerCase().replace(/\s+/g, "_")}`;

    const prod = await prisma.products.upsert({
      where: { legacy_id: legacySafe },
      update: {
        name,
        description: p.description ? String(p.description) : null,
        category: p.category ? String(p.category) : null,
        price: parseMoneyToDecimal(p.price ?? p.calculatedPrice ?? 0),
        subscriber_discount: Number(p.subscriberDiscount ?? 0),
        image_url: p.image ? String(p.image) : null,
        stock: Number(p.stock ?? 0),
        active: true,
        barbershop_id: barbershopId,
      },
      create: {
        legacy_id: legacySafe,
        name,
        description: p.description ? String(p.description) : null,
        category: p.category ? String(p.category) : null,
        price: parseMoneyToDecimal(p.price ?? p.calculatedPrice ?? 0),
        subscriber_discount: Number(p.subscriberDiscount ?? 0),
        image_url: p.image ? String(p.image) : null,
        stock: Number(p.stock ?? 0),
        active: true,
        barbershop_id: barbershopId,
      },
    });

    productIdByLegacy.set(legacySafe, prod.id);
    productIdByName.set(name.toLowerCase(), prod.id);
  }

  // 8) gallery
  const gallery = Array.isArray(data.gallery) ? data.gallery : [];
  for (let i = 0; i < gallery.length; i++) {
    const g = gallery[i];
    const legacy = String(g.id ?? i + 1);

    await prisma.gallery_images.upsert({
      where: { legacy_id: legacy },
      update: {
        alt: g.alt ? String(g.alt) : null,
        url: String(g.url),
        sort_order: Number(g.sort_order ?? i),
        barbershop_id: barbershopId,
      },
      create: {
        legacy_id: legacy,
        alt: g.alt ? String(g.alt) : null,
        url: String(g.url),
        sort_order: Number(g.sort_order ?? i),
        barbershop_id: barbershopId,
      },
    });
  }

  // 9) subscriptions + cycles (+ payment_transactions opcional)
  const subs = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  for (const s of subs) {
    const legacy = String(s.id);
    const userLegacy = String(s.userId);
    const planLegacy = String(s.planId);

    const userId = userIdByLegacy.get(userLegacy);
    const planId = planIdByLegacy.get(planLegacy);

    if (!userId || !planId) continue;

    const startedAt = s.startDate ? new Date(String(s.startDate)) : new Date();
    const nextBillingAt = s.nextBillingDate ? new Date(String(s.nextBillingDate)) : null;

    const subscription = await prisma.subscriptions.upsert({
      where: { legacy_id: legacy },
      update: {
        user_id: userId,
        plan_id: planId,
        status: normalizeSubscriptionStatus(s.status) as any,
        started_at: startedAt,
        next_billing_at: nextBillingAt,
        ended_at: s.endedAt ? new Date(String(s.endedAt)) : null,
        auto_renewal: Boolean(s.autoRenewal ?? true),
        payment_method: s.paymentMethod ? (normalizePaymentMethod(s.paymentMethod) as any) : null,
        barbershop_id: barbershopId,
      },
      create: {
        legacy_id: legacy,
        user_id: userId,
        plan_id: planId,
        status: normalizeSubscriptionStatus(s.status) as any,
        started_at: startedAt,
        next_billing_at: nextBillingAt,
        ended_at: s.endedAt ? new Date(String(s.endedAt)) : null,
        auto_renewal: Boolean(s.autoRenewal ?? true),
        payment_method: s.paymentMethod ? (normalizePaymentMethod(s.paymentMethod) as any) : null,
        barbershop_id: barbershopId,
      },
    });

    subscriptionIdByLegacy.set(legacy, subscription.id);

    // ciclo (usa startDate/nextBillingDate do mock)
    const periodStart = toDateOnly(startedAt);
    const periodEnd = toDateOnly(nextBillingAt ?? new Date(new Date(startedAt).setMonth(startedAt.getMonth() + 1)));

    // pega cuts_included do plano
    const plan = await prisma.subscription_plans.findUnique({ where: { id: planId } });
    const cutsIncluded = plan?.cuts_per_month ?? 0;

    const cycle = await prisma.subscription_cycles.upsert({
      where: {
        subscription_id_period_start_period_end: {
          subscription_id: subscription.id,
          period_start: periodStart,
          period_end: periodEnd,
        },
      },
      update: {
        cuts_included: cutsIncluded,
      },
      create: {
        subscription_id: subscription.id,
        period_start: periodStart,
        period_end: periodEnd,
        cuts_included: cutsIncluded,
        cuts_used: 0,
      },
    });

    subscriptionCycleIdBySubscription.set(subscription.id, cycle.id);

    // marca “assinatura ativa” por usuário (pra usar nos appointments)
    if (String(s.status).toLowerCase() === "active") {
      activeSubscriptionByUserLegacy.set(userLegacy, { subscriptionId: subscription.id, cycleId: cycle.id });
    }

    // cria 1 transação do último billing (se tiver)
    if (s.lastBillingDate) {
      const txLegacy = `sub:${legacy}:last`;
      await prisma.payment_transactions.upsert({
        where: { legacy_id: txLegacy },
        update: {
          user_id: userId,
          subscription_id: subscription.id,
          amount: parseMoneyToDecimal(s.amount ?? s.planPrice ?? 0),
          method: normalizePaymentMethod(s.paymentMethod ?? "subscription") as any,
          status: "paid" as any,
          paid_at: new Date(String(s.lastBillingDate)),
          status_raw: "seed",
          barbershop_id: barbershopId,
        },
        create: {
          legacy_id: txLegacy,
          user_id: userId,
          subscription_id: subscription.id,
          amount: parseMoneyToDecimal(s.amount ?? s.planPrice ?? 0),
          method: normalizePaymentMethod(s.paymentMethod ?? "subscription") as any,
          status: "paid" as any,
          paid_at: new Date(String(s.lastBillingDate)),
          status_raw: "seed",
          barbershop_id: barbershopId,
        },
      });
    }
  }

  // 10) appointments + joins
  const appointments = Array.isArray(data.appointments) ? data.appointments : [];
  for (const a of appointments) {
    const legacy = String(a.id);

    const barberLegacy = String(a.barberId);
    const clientLegacy = String(a.clientId);

    const barberId = barberIdByLegacy.get(barberLegacy);
    const clientId = userIdByLegacy.get(clientLegacy);

    if (!barberId || !clientId) continue;

    const servicesInAppt = Array.isArray(a.services) ? a.services : [];
    const productsInAppt = Array.isArray(a.products) ? a.products : [];

    const startAt = parseLocalDateTime(String(a.date), String(a.time));
    const totalDuration = servicesInAppt.reduce((sum: number, s: any) => {
      const d = Number(s.duration ?? s.durationMinutes ?? 0);
      return sum + (Number.isFinite(d) ? d : 0);
    }, 0);
    const endAt = new Date(startAt.getTime() + Math.max(totalDuration, 30) * 60_000);

    const appt = await prisma.appointments.upsert({
      where: { legacy_id: legacy },
      update: {
        barber_id: barberId,
        client_id: clientId,
        start_at: startAt,
        end_at: endAt,
        status: normalizeAppointmentStatus(a.status) as any,
        notes: a.notes ? String(a.notes) : null,
        barbershop_id: barbershopId,
      },
      create: {
        legacy_id: legacy,
        barber_id: barberId,
        client_id: clientId,
        start_at: startAt,
        end_at: endAt,
        status: normalizeAppointmentStatus(a.status) as any,
        notes: a.notes ? String(a.notes) : null,
        barbershop_id: barbershopId,
      },
    });

    // limpa itens antigos e recria (pra seed reexecutável)
    await prisma.appointment_services.deleteMany({ where: { appointment_id: appt.id } });
    await prisma.appointment_products.deleteMany({ where: { appointment_id: appt.id } });

    // appointment_services
    for (const s of servicesInAppt) {
      const serviceLegacy = s.id != null ? String(s.id) : null;
      const name = String(s.name ?? "Serviço");

      let serviceId: string | undefined;
      if (serviceLegacy) serviceId = serviceIdByLegacy.get(serviceLegacy);
      if (!serviceId) serviceId = serviceIdByName.get(name.toLowerCase());

      if (!serviceId) continue;

      await prisma.appointment_services.create({
        data: {
          appointment_id: appt.id,
          service_id: serviceId,
          service_name: name,
          unit_price: parseMoneyToDecimal(s.promotionalPrice && String(s.promotionalPrice).trim() !== "" ? s.promotionalPrice : s.price),
          duration_minutes: Number(s.duration ?? 0),
          quantity: 1,
        },
      });
    }

    // appointment_products
    for (const p of productsInAppt) {
      const productLegacy = p.id != null ? String(p.id) : null;
      const name = String(p.name ?? "Produto");

      // tenta achar por legacy ou por nome
      let productId: string | undefined;
      if (productLegacy) {
        productId = productIdByLegacy.get(productLegacy) ?? productIdByLegacy.get(`mock:${name.toLowerCase().replace(/\s+/g, "_")}`);
      }
      if (!productId) productId = productIdByName.get(name.toLowerCase());

      if (!productId) continue;

      const unit = p.calculatedPrice != null ? parseMoneyToDecimal(p.calculatedPrice) : parseMoneyToDecimal(p.price);

      await prisma.appointment_products.create({
        data: {
          appointment_id: appt.id,
          product_id: productId,
          product_name: name,
          unit_price: unit,
          discount_percent: Number(p.subscriberDiscount ?? 0),
          quantity: Number(p.quantity ?? 1),
        },
      });
    }

    // subscription usage (se tiver coveredByPlan no serviço do appointment e usuário com assinatura ativa)
    const coveredCount = servicesInAppt.filter((s: any) => s.coveredByPlan === true).length;
    if (coveredCount > 0) {
      const active = activeSubscriptionByUserLegacy.get(clientLegacy);
      if (active?.cycleId) {
        // upsert por appointment_id (é unique)
        await prisma.subscription_usages.upsert({
          where: { appointment_id: appt.id },
          update: {
            cycle_id: active.cycleId,
            credits_used: coveredCount,
          },
          create: {
            cycle_id: active.cycleId,
            appointment_id: appt.id,
            credits_used: coveredCount,
          },
        });

        // atualiza cuts_used do ciclo (bem simples: soma créditos)
        await prisma.subscription_cycles.update({
          where: { id: active.cycleId },
          data: { cuts_used: { increment: coveredCount } },
        });
      }
    }
  }

  console.log("✅ Seed finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao fazer seed:", e);
    // exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
