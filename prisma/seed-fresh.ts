/**
 * seed-fresh.ts
 *
 * Seed completo para banco novo. Cria tudo que o sistema precisa para funcionar:
 *   1. Super Admin (acesso à plataforma)
 *   2. Barbearia padrão
 *   3. Admin da barbearia
 *   4. 2 barbeiros (com usuário vinculado)
 *   5. 5 serviços
 *   6. Configurações e home info da barbearia
 *   7. Planos da plataforma (visíveis no SuperAdmin)
 *
 * Idempotente — pode ser executado várias vezes sem duplicar dados.
 *
 * Como executar:
 *   npx tsx prisma/seed-fresh.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Configuração ────────────────────────────────────────────────────────────

const BARBERSHOP = {
  name: "BarberOne",
  slug: "barberone",
  phone: "(11) 99999-0000",
  email: "contato@barberone.com",
  cnpj: null as string | null,
};

const SUPER_ADMIN = {
  name: "Super Admin",
  email: "superadm@barberone.com",
  password: "123456",
};

const ADMIN = {
  name: "Administrador",
  email: "admin@barberone.com",
  password: "123456",
};

const BARBERS = [
  {
    name: "João Silva",
    email: "joao@barberone.com",
    password: "123456",
    specialty: "Corte clássico e degradê",
    commissionPercent: 40,
  },
  {
    name: "Pedro Costa",
    email: "pedro@barberone.com",
    password: "123456",
    specialty: "Barba e acabamento",
    commissionPercent: 40,
  },
];

const SERVICES = [
  { name: "Corte de Cabelo",   price: 35.0, duration: 30 },
  { name: "Barba",             price: 25.0, duration: 20 },
  { name: "Corte + Barba",     price: 55.0, duration: 50 },
  { name: "Pézinho",           price: 15.0, duration: 15 },
  { name: "Sobrancelha",       price: 15.0, duration: 15 },
];

const PLATFORM_PLANS = [
  {
    name: "Básico",
    description: "Ideal para barbearias pequenas",
    price: 49.90,
    maxBarbers: 1,
    maxAdmins: 1,
    maxReceptionists: 0,
    isPublic: true,
    isRecommended: false,
    sortOrder: 1,
    features: [
      "1 barbeiro",
      "Agendamento online",
      "Gestão de serviços",
      "Relatórios básicos",
    ],
  },
  {
    name: "Profissional",
    description: "Para barbearias em crescimento",
    price: 99.90,
    maxBarbers: 3,
    maxAdmins: 2,
    maxReceptionists: 1,
    isPublic: true,
    isRecommended: true,
    sortOrder: 2,
    features: [
      "Até 3 barbeiros",
      "Agendamento online",
      "Gestão de serviços e produtos",
      "Planos de assinatura para clientes",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
  },
  {
    name: "Premium",
    description: "Sem limites, recursos completos",
    price: 199.90,
    maxBarbers: null,
    maxAdmins: null,
    maxReceptionists: null,
    isPublic: true,
    isRecommended: false,
    sortOrder: 3,
    features: [
      "Barbeiros ilimitados",
      "Agendamento online",
      "Gestão completa",
      "Planos de assinatura para clientes",
      "Pagamentos online (PIX e cartão)",
      "Relatórios avançados",
      "Multi-admin",
      "Suporte prioritário 24h",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function upsertUserByEmail(data: {
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "admin" | "barber" | "client" | "receptionist";
  isAdmin: boolean;
  barbershopId: string | null;
}) {
  const passwordHash = await hash(data.password);
  const existing = await prisma.users.findFirst({ where: { email: data.email } });

  if (existing) {
    return prisma.users.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        role: data.role,
        is_admin: data.isAdmin,
        password_hash: passwordHash,
        current_barbershop_id: data.barbershopId,
      },
    });
  }

  return prisma.users.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      is_admin: data.isAdmin,
      password_hash: passwordHash,
      current_barbershop_id: data.barbershopId,
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed-fresh...\n");

  // 1. Super Admin ─────────────────────────────────────────────────────────────
  console.log("👤 Criando Super Admin...");
  await upsertUserByEmail({
    name: SUPER_ADMIN.name,
    email: SUPER_ADMIN.email,
    password: SUPER_ADMIN.password,
    role: "super_admin",
    isAdmin: true,
    barbershopId: null,
  });
  console.log(`   ✅ ${SUPER_ADMIN.email} / senha: ${SUPER_ADMIN.password}`);

  // 2. Barbearia ───────────────────────────────────────────────────────────────
  console.log("\n🏪 Criando barbearia...");
  const barbershop = await prisma.barbershops.upsert({
    where: { slug: BARBERSHOP.slug },
    update: {
      name: BARBERSHOP.name,
      phone: BARBERSHOP.phone,
      email: BARBERSHOP.email,
      status: "active",
    },
    create: {
      name: BARBERSHOP.name,
      slug: BARBERSHOP.slug,
      phone: BARBERSHOP.phone,
      email: BARBERSHOP.email,
      cnpj: BARBERSHOP.cnpj,
      status: "active",
    },
  });
  const barbershopId = barbershop.id;
  console.log(`   ✅ "${BARBERSHOP.name}" (id: ${barbershopId})`);

  // Configurações da barbearia
  await prisma.barbershop_settings.upsert({
    where: { barbershop_id: barbershopId },
    update: { slot_interval_minutes: 30 },
    create: {
      barbershop_id: barbershopId,
      slot_interval_minutes: 30,
    },
  });

  // Home info
  await prisma.barbershop_home_info.upsert({
    where: { barbershop_id: barbershopId },
    update: {},
    create: {
      barbershop_id: barbershopId,
      hero_title: "Bem-vindo à BarberOne",
      hero_subtitle: "Estilo e precisão em cada corte.",
      about_title: "Sobre nós",
      about_text1: "Somos apaixonados pelo que fazemos.",
      schedule_title: "Horários de atendimento",
      schedule_line1: "Segunda a Sexta: 09h às 19h",
      schedule_line2: "Sábado: 09h às 17h",
      schedule_line3: "Domingo: Fechado",
    },
  });

  // 3. Admin da barbearia ──────────────────────────────────────────────────────
  console.log("\n👤 Criando Admin da barbearia...");
  const adminUser = await upsertUserByEmail({
    name: ADMIN.name,
    email: ADMIN.email,
    password: ADMIN.password,
    role: "admin",
    isAdmin: true,
    barbershopId,
  });

  await prisma.user_barbershops.upsert({
    where: { user_id_barbershop_id: { user_id: adminUser.id, barbershop_id: barbershopId } },
    update: {},
    create: { user_id: adminUser.id, barbershop_id: barbershopId },
  });
  console.log(`   ✅ ${ADMIN.email} / senha: ${ADMIN.password}`);

  // 4. Barbeiros ───────────────────────────────────────────────────────────────
  console.log("\n✂️  Criando barbeiros...");
  for (const b of BARBERS) {
    const barberUser = await upsertUserByEmail({
      name: b.name,
      email: b.email,
      password: b.password,
      role: "barber",
      isAdmin: false,
      barbershopId,
    });

    await prisma.user_barbershops.upsert({
      where: { user_id_barbershop_id: { user_id: barberUser.id, barbershop_id: barbershopId } },
      update: {},
      create: { user_id: barberUser.id, barbershop_id: barbershopId },
    });

    await prisma.barbers.upsert({
      where: { user_id: barberUser.id },
      update: {
        display_name: b.name,
        specialty: b.specialty,
        commission_percent: b.commissionPercent,
        barbershop_id: barbershopId,
      },
      create: {
        display_name: b.name,
        specialty: b.specialty,
        commission_percent: b.commissionPercent,
        user_id: barberUser.id,
        barbershop_id: barbershopId,
      },
    });

    console.log(`   ✅ ${b.email} / senha: ${b.password}`);
  }

  // 5. Serviços ────────────────────────────────────────────────────────────────
  console.log("\n💈 Criando serviços...");
  for (const s of SERVICES) {
    const existing = await prisma.services.findFirst({
      where: { name: s.name, barbershop_id: barbershopId },
    });

    if (existing) {
      await prisma.services.update({
        where: { id: existing.id },
        data: {
          base_price: s.price,
          duration_minutes: s.duration,
          active: true,
        },
      });
    } else {
      await prisma.services.create({
        data: {
          name: s.name,
          base_price: s.price,
          duration_minutes: s.duration,
          active: true,
          barbershop_id: barbershopId,
        },
      });
    }
    console.log(`   ✅ ${s.name} — R$ ${s.price.toFixed(2)} / ${s.duration} min`);
  }

  // 6. Planos da plataforma (SuperAdmin) ───────────────────────────────────────
  console.log("\n📦 Criando planos da plataforma...");
  for (const p of PLATFORM_PLANS) {
    const existing = await prisma.platform_plans.findFirst({
      where: { name: p.name },
    });

    let planId: string;

    if (existing) {
      await prisma.platform_plans.update({
        where: { id: existing.id },
        data: {
          description: p.description,
          price: p.price,
          max_barbers: p.maxBarbers,
          max_admins: p.maxAdmins,
          max_receptionists: p.maxReceptionists,
          is_public: p.isPublic,
          is_recommended: p.isRecommended,
          sort_order: p.sortOrder,
          active: true,
        },
      });
      planId = existing.id;
    } else {
      const created = await prisma.platform_plans.create({
        data: {
          name: p.name,
          description: p.description,
          price: p.price,
          max_barbers: p.maxBarbers,
          max_admins: p.maxAdmins,
          max_receptionists: p.maxReceptionists,
          is_public: p.isPublic,
          is_recommended: p.isRecommended,
          sort_order: p.sortOrder,
          active: true,
        },
      });
      planId = created.id;
    }

    // Recria features
    await prisma.platform_plan_features.deleteMany({ where: { plan_id: planId } });
    await prisma.platform_plan_features.createMany({
      data: p.features.map((feature, idx) => ({
        plan_id: planId,
        feature,
        sort_order: idx,
      })),
    });

    console.log(`   ✅ ${p.name} — R$ ${p.price.toFixed(2)}/mês`);
  }

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  console.log(`
╔════════════════════════════════════════════════════╗
║              ✅  Seed concluído!                   ║
╠════════════════════════════════════════════════════╣
║  Barbearia : ${BARBERSHOP.name.padEnd(35)}║
╠════════════════════════════════════════════════════╣
║  Super Admin: ${SUPER_ADMIN.email.padEnd(34)}║
║  Admin      : ${ADMIN.email.padEnd(34)}║
${BARBERS.map((b) => `║  Barbeiro   : ${b.email.padEnd(34)}║`).join("\n")}
╠════════════════════════════════════════════════════╣
║  Senha padrão de todos: 123456                     ║
╚════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed-fresh:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
