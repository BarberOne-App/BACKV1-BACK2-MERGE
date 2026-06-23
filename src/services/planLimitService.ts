// /**
//  * Service para validar limites de cadastro de usuários por plano de assinatura
//  * 
//  * Plano Básico:
//  * - Máximo 2 barbeiros
//  * - Máximo 1 admin
//  * - Máximo 1 recepcionista
//  * 
//  * Plano Premium:
//  * - Sem limitações
//  */

// import prisma from "../database/database.js";
// import { forbidden } from "../errors/index.js";

// // Configuração de limites por plano e role
// const PLAN_LIMITS: Record<string, Record<string, number>> = {
//   basic: {
//     barber: 2,
//     admin: 1,
//     receptionist: 1,
//   },
//   // Premium não tem limites
// };

// /**
//  * Obtém a assinatura ativa da barbearia
//  * Considera os status: active, trialing, paid, approved
//  */
// export async function getActiveBarbershopSubscription(barbershopId: string) {
//   const startOfToday = new Date();
//   startOfToday.setHours(0, 0, 0, 0);

//   const subscription = await prisma.subscriptions.findFirst({
//     where: {
//       barbershop_id: barbershopId,
//       status: {
//         in: ["active"], // Pode adicionar "trialing", "paid", "approved" conforme necessário
//       },
//       OR: [
//         { next_billing_at: null },
//         { next_billing_at: { gte: startOfToday } },
//       ],
//     },
//     include: {
//       subscription_plans: {
//         select: {
//           id: true,
//           name: true,
//           price: true,
//           cuts_per_month: true,
//         },
//       },
//     },
//     orderBy: [{ last_billing_at: "desc" }, { created_at: "desc" }],
//   });

//   return subscription;
// }

// /**
//  * Normaliza o nome do plano para comparação (lowercase)
//  */
// function normalizePlanName(planName: string): string {
//   return planName.toLowerCase().trim();
// }

// /**
//  * Obtém a chave do plano baseado no nome
//  */
// function getPlanKey(planName: string | null | undefined): string | null {
//   if (!planName) return null;

//   const normalized = normalizePlanName(planName);

//   if (normalized.includes("basic") || normalized.includes("básico")) {
//     return "basic";
//   }
//   if (normalized.includes("premium")) {
//     return "premium";
//   }

//   // Se não for premium, assume básico por segurança
//   return "basic";
// }

// /**
//  * Conta quantos usuários de uma role específica existem na barbearia
//  * (não inclui deletados ou inativos)
//  * 
//  * Para role "barber", conta registros na tabela barbers em vez de users
//  */
// export async function countUsersByRoleInBarbershop(
//   barbershopId: string,
//   role: string
// ): Promise<number> {
//   // Para barbeiros, contar registros na tabela barbers
//   if (role === "barber") {
//     const count = await prisma.barbers.count({
//       where: {
//         barbershop_id: barbershopId,
//       },
//     });
//     return count;
//   }

//   // Para outras roles, contar na tabela users
//   const count = await prisma.users.count({
//     where: {
//       current_barbershop_id: barbershopId,
//       role: role as any,
//     },
//   });

//   return count;
// }

// /**
//  * Valida se é possível adicionar um novo usuário com a role especificada
//  * 
//  * @param barbershopId - ID da barbearia
//  * @param role - Role do usuário a ser criado (barber, admin, receptionist)
//  * @throws Error se o limite for excedido
//  * @returns Objeto com informações do plano e validação
//  */
// export async function validatePlanUserLimit(
//   barbershopId: string,
//   role: string
// ): Promise<{
//   allowed: boolean;
//   planKey: string | null;
//   planName: string | null;
//   message?: string;
// }> {
//   // Busca a assinatura ativa
//   const subscription = await getActiveBarbershopSubscription(barbershopId);

//   // Se não tiver assinatura ativa, bloqueia (não tem plano)
//   if (!subscription) {
//     throw forbidden(
//       "Esta barbearia não possui um plano de assinatura ativo. Faça upgrade para continuar."
//     );
//   }

//   const planName = subscription.subscription_plans?.name || null;
//   const planKey = getPlanKey(planName);

//   console.log("PLANO ENCONTRADO AQUI:", planName);

//   // Se for premium, libera
//   if (planKey === "premium") {
//     return {
//       allowed: true,
//       planKey,
//       planName,
//     };
//   }

//   // Se for básico, valida limite
//   const limits = PLAN_LIMITS[planKey || "basic"];
//   if (!limits) {
//     // Fallback: se não tiver limites definidos, libera
//     return {
//       allowed: true,
//       planKey,
//       planName,
//     };
//   }

//   const roleLimit = limits[role];
//   if (roleLimit === undefined) {
//     // Se a role não tem limite definido, libera
//     return {
//       allowed: true,
//       planKey,
//       planName,
//     };
//   }

//   // Conta usuários atuais com essa role
//   const currentCount = await countUsersByRoleInBarbershop(barbershopId, role);

//   // Se já atingiu o limite, bloqueia
//   if (currentCount >= roleLimit) {
//     const roleLabel = getRoleLabel(role);
//     const upgradeSuffix =
//       role === "barber"
//         ? "Faça upgrade para o plano premium para adicionar mais barbeiros."
//         : "";

//     const message =
//       `Seu plano básico permite no máximo ${roleLimit} ${roleLabel}${roleLimit > 1 ? "s" : ""}. ${upgradeSuffix}`.trim();

//     throw forbidden(message);
//   }

//   return {
//     allowed: true,
//     planKey,
//     planName,
//   };
// }

// /**
//  * Traduz role para label em português
//  */
// function getRoleLabel(role: string): string {
//   const labels: Record<string, string> = {
//     barber: "barbeiro",
//     admin: "administrador",
//     receptionist: "recepcionista",
//     client: "cliente",
//   };

//   return labels[role] || role;
// }

// /**
//  * Interface para resposta de validação
//  */
// export interface PlanLimitValidation {
//   allowed: boolean;
//   planKey: string | null;
//   planName: string | null;
//   message?: string;
// }


import prisma from "../database/database.js";
import { forbidden } from "../errors/index.js";
import { expirePlatformSubscription, getStartOfToday } from "./subscriptionExpirationService.js";

const TRIAL_PERIOD_DAYS = Number(process.env.TRIAL_PERIOD_DAYS || 14);

export interface PlanLimitValidation {
  allowed: boolean;
  planName: string | null;
  message?: string;
}

export async function getActivePlatformSubscription(barbershopId: string) {
  await expirePlatformSubscription(barbershopId);

  return prisma.barbershop_platform_subscriptions.findFirst({
    where: {
      barbershop_id: barbershopId,
      status: {
        in: ['active', 'future', 'trialing', 'pending'],
      },
      canceled_at: null,
      OR: [
        { next_billing_date: null },
        { next_billing_date: { gte: getStartOfToday() } },
      ],
    },
    include: {
      platform_plans: {
        select: {
          id: true,
          name: true,
          max_barbers: true,
          max_admins: true,
          max_receptionists: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

function toValidDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function isTrialStillActive(createdAt: unknown): boolean {
  const validCreatedAt = toValidDate(createdAt);
  if (!validCreatedAt) return false;

  const trialEndsAt = new Date(
    validCreatedAt.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );

  return new Date() <= trialEndsAt;
}

async function getTrialPlatformPlan(barbershopId: string) {
  const barbershop = await prisma.barbershops.findUnique({
    where: { id: barbershopId },
    select: {
      id: true,
      created_at: true,
      selected_plan: true,
      platform_subscription_status: true,
    },
  });

  if (!barbershop) {
    return null;
  }

  const subscriptionStatus = String(barbershop.platform_subscription_status || "")
    .toLowerCase()
    .trim();
  const hasActiveSubscription = ['active', 'future', 'trialing', 'pending'].includes(subscriptionStatus);

  if (hasActiveSubscription) {
    return null;
  }

  if (!isTrialStillActive(barbershop.created_at)) {
    return null;
  }

  const selectedPlan = String(barbershop.selected_plan || "").trim();
  if (!selectedPlan) {
    return null;
  }

  const platformPlan = await prisma.platform_plans.findFirst({
    where: {
      OR: [
        { name: selectedPlan },
        { id: selectedPlan },
      ],
    },
    select: {
      id: true,
      name: true,
      max_barbers: true,
      max_admins: true,
      max_receptionists: true,
    },
    orderBy: { created_at: 'desc' },
  });

  if (!platformPlan) {
    return null;
  }

  return {
    planName: platformPlan.name,
    platformPlan,
  };
}

export async function countUsersByRoleInBarbershop(
  barbershopId: string,
  role: string
): Promise<number> {
  return prisma.users.count({
    where: {
      current_barbershop_id: barbershopId,
      role: role as any,
    },
  });
}

function getRoleLimit(plan: any, role: string): number | null {
  if (!plan) return null;
  if (role === 'barber') return plan.max_barbers ?? null;
  if (role === 'admin') return plan.max_admins ?? null;
  if (role === 'receptionist') return plan.max_receptionists ?? null;
  return null;
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    barber: "barbeiro",
    admin: "administrador",
    receptionist: "recepcionista",
    client: "cliente",
  };
  return labels[role] || role;
}

function getRoleLimitLabel(role: string): string {
  const labels: Record<string, string> = {
    barber: "BARBEIRO",
    admin: "ADM",
    receptionist: "RECEPCIONISTA",
  };
  return labels[role] || role.toUpperCase();
}

export async function validatePlanUserLimit(
  barbershopId: string,
  role: string
): Promise<PlanLimitValidation> {
  const platformSubscription = await getActivePlatformSubscription(barbershopId);
  const trialPlatformPlan = platformSubscription
    ? null
    : await getTrialPlatformPlan(barbershopId);

  if (!platformSubscription && !trialPlatformPlan) {
    throw forbidden(
      "Esta barbearia não possui um plano de assinatura ativo. Faça upgrade para continuar."
    );
  }

  const platformPlan = (platformSubscription?.platform_plans ?? trialPlatformPlan?.platformPlan) as any;
  const planName =
    platformPlan?.name ??
    platformSubscription?.selected_plan ??
    trialPlatformPlan?.planName ??
    null;

  if (platformSubscription) {
    console.log("Assinatura ativa encontrada:", {
      id: platformSubscription.id,
      status: platformSubscription.status,
      selected_plan: platformSubscription.selected_plan,
      platform_plans: platformSubscription.platform_plans,
    });
  } else if (trialPlatformPlan) {
    console.log("Plano liberado pelo período de teste encontrado:", {
      barbershopId,
      planName,
      platformPlan,
    });
  }

  const roleLimit = getRoleLimit(platformPlan, role);

  console.log(`Limite para o papel ${role} no plano ${planName}:`, roleLimit);

  // null significa ilimitado
  if (roleLimit === null) {
    return { allowed: true, planName };
  }

  const currentCount = await countUsersByRoleInBarbershop(barbershopId, role);

  console.log("Contagem atual de usuários com o papel", role, "na barbearia:", currentCount);

  if (currentCount >= roleLimit) {
    const roleLimitLabel = getRoleLimitLabel(role);
    const currentPlanName = planName ?? "atual";
    const message = `Limite para ${roleLimitLabel} atingido pelo plano ${currentPlanName}. Para adicionar mais, faça um upgrade do plano.`;
    throw forbidden(message);
  }

  return { allowed: true, planName };
}
