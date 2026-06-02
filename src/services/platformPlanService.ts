import crypto from 'crypto';
import { notFound, badRequest, AppError } from '../errors/index.js';
import { pagarmeRequest } from './pagarmeApi.js';
import {
  listPlatformPlansFromDB,
  findPlatformPlanById,
  createPlatformPlanInDB,
  updatePlatformPlanInDB,
  deletePlatformPlanFromDB,
} from '../repository/platformPlanRepository.js';

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v?.toNumber === 'function') return v.toNumber();
  return Number(v);
}

function serialize(plan: any) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: decimalToNumber(plan.price),
    interval: plan.interval,
    intervalCount: plan.interval_count,
    trialPeriodDays: plan.trial_period_days,
    pagarmePlanId: plan.pagarme_plan_id,
    maxBarbers: plan.max_barbers,
    maxAdmins: plan.max_admins,
    maxReceptionists: plan.max_receptionists,
    isPublic: plan.is_public,
    isRecommended: plan.is_recommended,
    sortOrder: plan.sort_order,
    active: plan.active,
    features: (plan.features ?? []).map((f: any) => f.feature),
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

function isPagarmeConfigured() {
  return Boolean(String(process.env.PAGARME_SECRET_KEY || '').trim());
}

async function createPagarmePlanForPlatform(params: {
  name: string;
  description?: string | null;
  price: number;
  interval?: string;
  intervalCount?: number;
  trialPeriodDays?: number;
  statementDescriptor?: string | null;
  paymentMethods?: string[];
}) {
  const amountInCents = Math.round(params.price * 100);
  if (!amountInCents || amountInCents <= 0) {
    throw badRequest('Valor do plano inválido para criar no Pagar.me.');
  }

  const paymentMethods =
    Array.isArray(params.paymentMethods) && params.paymentMethods.length
      ? params.paymentMethods
      : ['credit_card'];

  const payload = {
    name: params.name,
    description: params.description || undefined,
    currency: 'BRL',
    interval: params.interval || 'month',
    interval_count: Number(params.intervalCount || 1),
    billing_type: 'prepaid',
    payment_methods: paymentMethods,
    installments: [1],
    trial_period_days: Number(params.trialPeriodDays || 0),
    statement_descriptor: params.statementDescriptor || 'BARBERONE',
    items: [
      {
        name: params.name,
        quantity: 1,
        pricing_scheme: {
          price: amountInCents,
        },
      },
    ],
    metadata: {
      type: 'platform_plan',
    },
  };

  try {
    return await pagarmeRequest('/plans', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;

    const msg = String(
      err?.message ||
      err?.details?.message ||
      'Erro ao criar plano no Pagar.me.'
    );

    if (msg.includes('PAGARME_SECRET_KEY')) {
      throw new AppError(503, 'Integração Pagar.me não configurada no servidor. Defina PAGARME_SECRET_KEY no .env do backend.');
    }

    throw new AppError(err?.status === 422 ? 422 : 400, `Pagar.me: ${msg}`);
  }
}

async function updatePagarmePlanForPlatform(pagarmePlanId: string, params: {
  name: string;
  status: string;
  currency: string;
  interval: string;
  intervalCount: number;
  description?: string | null;
  statementDescriptor?: string | null;
  paymentMethods?: string[];
}) {
  // Pagar.me não permite alterar preço via PUT — apenas campos de metadados do plano
  const payload: Record<string, any> = {
    name: params.name,
    status: params.status,
    currency: params.currency,
    interval: params.interval,
    interval_count: params.intervalCount,
    billing_type: 'prepaid',
  };

  if (typeof params.description === 'string' && params.description.trim()) {
    payload.description = params.description.trim();
  }
  if (params.statementDescriptor) {
    payload.statement_descriptor = params.statementDescriptor;
  }
  if (Array.isArray(params.paymentMethods) && params.paymentMethods.length) {
    payload.payment_methods = params.paymentMethods;
  }

  try {
    return await pagarmeRequest(`/plans/${pagarmePlanId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.status === 404) return null;
    const msg = String(err?.message || 'Erro ao atualizar plano no Pagar.me.');
    throw new AppError(err?.status === 422 ? 422 : 400, `Pagar.me: ${msg}`);
  }
}

async function deletePagarmePlanForPlatform(pagarmePlanId: string) {
  try {
    return await pagarmeRequest(`/plans/${pagarmePlanId}`, { method: 'DELETE' });
  } catch (err: any) {
    // Qualquer erro do Pagar.me no DELETE não bloqueia a exclusão local
    // (plano pode já estar deletado, ter assinaturas ativas, ou estar inacessível)
    console.warn(`[Pagar.me] Erro ao excluir plano ${pagarmePlanId} (status ${err?.status}): ${err?.message}`);
    return null;
  }
}

export async function listPlatformPlansService(params: {
  activeOnly?: boolean;
  publicOnly?: boolean;
}) {
  const items = await listPlatformPlansFromDB(params);
  return items.map(serialize);
}

export async function getPlatformPlanByIdService(id: string) {
  const plan = await findPlatformPlanById(id);
  if (!plan) throw notFound('Plano não encontrado');
  return serialize(plan);
}

export async function createPlatformPlanService(params: {
  name: string;
  description?: string | null;
  price: number;
  interval?: string;
  intervalCount?: number;
  trialPeriodDays?: number;
  maxBarbers?: number | null;
  maxAdmins?: number | null;
  maxReceptionists?: number | null;
  isPublic?: boolean;
  isRecommended?: boolean;
  sortOrder?: number;
  active?: boolean;
  features?: string[];
  paymentMethods?: string[];
  statementDescriptor?: string | null;
  syncPagarme?: boolean;
}) {
  const { syncPagarme = true, ...data } = params;

  const shouldSyncPagarme = syncPagarme && isPagarmeConfigured();

  if (!shouldSyncPagarme) {
    const created = await createPlatformPlanInDB(data);
    if (!created) throw new Error('Falha ao criar plano da plataforma.');
    return { ...serialize(created), pagarmeSkipped: !isPagarmeConfigured() };
  }

  const pagarmePlan = await createPagarmePlanForPlatform({
    name: data.name,
    description: data.description,
    price: data.price,
    interval: data.interval,
    intervalCount: data.intervalCount,
    trialPeriodDays: data.trialPeriodDays,
    statementDescriptor: data.statementDescriptor,
    paymentMethods: data.paymentMethods,
  });

  const created = await createPlatformPlanInDB({
    ...data,
    pagarmePlanId: pagarmePlan.id,
  });

  if (!created) {
    throw new Error('Plano criado no Pagar.me mas falhou ao salvar no banco.');
  }

  return serialize(created);
}

export async function updatePlatformPlanService(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    price?: number;
    interval?: string;
    intervalCount?: number;
    trialPeriodDays?: number;
    maxBarbers?: number | null;
    maxAdmins?: number | null;
    maxReceptionists?: number | null;
    isPublic?: boolean;
    isRecommended?: boolean;
    sortOrder?: number;
    active?: boolean;
    features?: string[];
    statementDescriptor?: string | null;
    paymentMethods?: string[];
  }
) {
  const existing = await findPlatformPlanById(id);
  if (!existing) throw notFound('Plano não encontrado');

  let newPagarmePlanId: string | undefined;

  if (existing.pagarme_plan_id && isPagarmeConfigured()) {
    const currentPrice = decimalToNumber(existing.price);
    const priceChanged = data.price !== undefined && Math.abs(currentPrice - data.price) > 0.001;

    if (priceChanged) {
      // Pagar.me não permite alterar preço de plano existente
      // Solução: cria novo plano com o novo preço e arquiva o antigo
      const newPagarmePlan = await createPagarmePlanForPlatform({
        name: data.name ?? existing.name,
        description: typeof data.description === 'string'
          ? data.description
          : (existing.description ?? undefined),
        price: data.price!,
        interval: existing.interval,
        intervalCount: Number(existing.interval_count ?? 1),
        trialPeriodDays: Number(existing.trial_period_days ?? 0),
        statementDescriptor: data.statementDescriptor || 'BARBERONE',
        paymentMethods: data.paymentMethods ?? ['credit_card'],
      });
      await deletePagarmePlanForPlatform(existing.pagarme_plan_id);
      newPagarmePlanId = newPagarmePlan.id;
    } else {
      // Preço não mudou — atualiza metadados via PUT
      await updatePagarmePlanForPlatform(existing.pagarme_plan_id, {
        name: data.name ?? existing.name,
        status: 'active',
        currency: 'BRL',
        interval: existing.interval,
        intervalCount: Number(existing.interval_count ?? 1),
        description: data.description !== undefined ? data.description : existing.description,
        statementDescriptor: data.statementDescriptor,
        paymentMethods: data.paymentMethods,
      });
    }
  }

  const updated = await updatePlatformPlanInDB(id, {
    ...data,
    ...(newPagarmePlanId !== undefined ? { pagarmePlanId: newPagarmePlanId } : {}),
  });
  if (!updated) throw notFound('Plano não encontrado');
  return serialize(updated);
}

export async function deletePlatformPlanService(id: string) {
  const existing = await findPlatformPlanById(id);
  if (!existing) throw notFound('Plano não encontrado');

  if (existing.pagarme_plan_id && isPagarmeConfigured()) {
    await deletePagarmePlanForPlatform(existing.pagarme_plan_id);
  }

  const deleted = await deletePlatformPlanFromDB(id);
  if (!deleted) throw notFound('Plano não encontrado');
  return { message: 'Plano da plataforma removido com sucesso' };
}
