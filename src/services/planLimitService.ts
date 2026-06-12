/**
 * Service para validar limites de cadastro de usuários por plano de assinatura
 * 
 * Plano Básico:
 * - Máximo 2 barbeiros
 * - Máximo 1 admin
 * - Máximo 1 recepcionista
 * 
 * Plano Premium:
 * - Sem limitações
 */

import prisma from "../database/database.js";
import { forbidden } from "../errors/index.js";

// Configuração de limites por plano e role
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  basic: {
    barber: 2,
    admin: 1,
    receptionist: 1,
  },
  // Premium não tem limites
};

/**
 * Obtém a assinatura ativa da barbearia
 * Considera os status: active, trialing, paid, approved
 */
export async function getActiveBarbershopSubscription(barbershopId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const subscription = await prisma.subscriptions.findFirst({
    where: {
      barbershop_id: barbershopId,
      status: {
        in: ["active"], // Pode adicionar "trialing", "paid", "approved" conforme necessário
      },
      OR: [
        { next_billing_at: null },
        { next_billing_at: { gte: startOfToday } },
      ],
    },
    include: {
      subscription_plans: {
        select: {
          id: true,
          name: true,
          price: true,
          cuts_per_month: true,
        },
      },
    },
    orderBy: [{ last_billing_at: "desc" }, { created_at: "desc" }],
  });

  return subscription;
}

/**
 * Normaliza o nome do plano para comparação (lowercase)
 */
function normalizePlanName(planName: string): string {
  return planName.toLowerCase().trim();
}

/**
 * Obtém a chave do plano baseado no nome
 */
function getPlanKey(planName: string | null | undefined): string | null {
  if (!planName) return null;

  const normalized = normalizePlanName(planName);

  if (normalized.includes("basic") || normalized.includes("básico")) {
    return "basic";
  }
  if (normalized.includes("premium")) {
    return "premium";
  }

  // Se não for premium, assume básico por segurança
  return "basic";
}

/**
 * Conta quantos usuários de uma role específica existem na barbearia
 * (não inclui deletados ou inativos)
 * 
 * Para role "barber", conta registros na tabela barbers em vez de users
 */
export async function countUsersByRoleInBarbershop(
  barbershopId: string,
  role: string
): Promise<number> {
  // Para barbeiros, contar registros na tabela barbers
  if (role === "barber") {
    const count = await prisma.barbers.count({
      where: {
        barbershop_id: barbershopId,
      },
    });
    return count;
  }

  // Para outras roles, contar na tabela users
  const count = await prisma.users.count({
    where: {
      current_barbershop_id: barbershopId,
      role: role as any,
    },
  });

  return count;
}

/**
 * Valida se é possível adicionar um novo usuário com a role especificada
 * 
 * @param barbershopId - ID da barbearia
 * @param role - Role do usuário a ser criado (barber, admin, receptionist)
 * @throws Error se o limite for excedido
 * @returns Objeto com informações do plano e validação
 */
export async function validatePlanUserLimit(
  barbershopId: string,
  role: string
): Promise<{
  allowed: boolean;
  planKey: string | null;
  planName: string | null;
  message?: string;
}> {
  // Busca a assinatura ativa
  const subscription = await getActiveBarbershopSubscription(barbershopId);

  // Se não tiver assinatura ativa, bloqueia (não tem plano)
  if (!subscription) {
    throw forbidden(
      "Esta barbearia não possui um plano de assinatura ativo. Faça upgrade para continuar."
    );
  }

  const planName = subscription.subscription_plans?.name || null;
  const planKey = getPlanKey(planName);

  console.log("PLANO ENCONTRADO AQUI:", planName);

  // Se for premium, libera
  if (planKey === "premium") {
    return {
      allowed: true,
      planKey,
      planName,
    };
  }

  // Se for básico, valida limite
  const limits = PLAN_LIMITS[planKey || "basic"];
  if (!limits) {
    // Fallback: se não tiver limites definidos, libera
    return {
      allowed: true,
      planKey,
      planName,
    };
  }

  const roleLimit = limits[role];
  if (roleLimit === undefined) {
    // Se a role não tem limite definido, libera
    return {
      allowed: true,
      planKey,
      planName,
    };
  }

  // Conta usuários atuais com essa role
  const currentCount = await countUsersByRoleInBarbershop(barbershopId, role);

  // Se já atingiu o limite, bloqueia
  if (currentCount >= roleLimit) {
    const roleLabel = getRoleLabel(role);
    const upgradeSuffix =
      role === "barber"
        ? "Faça upgrade para o plano premium para adicionar mais barbeiros."
        : "";

    const message =
      `Seu plano básico permite no máximo ${roleLimit} ${roleLabel}${roleLimit > 1 ? "s" : ""}. ${upgradeSuffix}`.trim();

    throw forbidden(message);
  }

  return {
    allowed: true,
    planKey,
    planName,
  };
}

/**
 * Traduz role para label em português
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    barber: "barbeiro",
    admin: "administrador",
    receptionist: "recepcionista",
    client: "cliente",
  };

  return labels[role] || role;
}

/**
 * Interface para resposta de validação
 */
export interface PlanLimitValidation {
  allowed: boolean;
  planKey: string | null;
  planName: string | null;
  message?: string;
}
