import prisma from '../database/database.js';

export async function listPlatformPlansFromDB(params: {
  activeOnly?: boolean;
  publicOnly?: boolean;
}) {
  const where: any = {};
  if (params.activeOnly) where.active = true;
  if (params.publicOnly) where.is_public = true;

  return prisma.platform_plans.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { price: 'asc' }],
    include: {
      platform_plan_features: { orderBy: { sort_order: 'asc' } },
    },
  });
}

export async function findPlatformPlanById(id: string) {
  return prisma.platform_plans.findUnique({
    where: { id },
    include: {
      platform_plan_features: { orderBy: { sort_order: 'asc' } },
    },
  });
}

export async function findPlatformPlanByPagarmeId(pagarmeId: string) {
  return prisma.platform_plans.findFirst({
    where: { pagarme_plan_id: pagarmeId },
    include: {
      platform_plan_features: { orderBy: { sort_order: 'asc' } },
    },
  });
}

export async function createPlatformPlanInDB(data: {
  name: string;
  description?: string | null;
  price: number;
  interval?: string;
  intervalCount?: number;
  trialPeriodDays?: number;
  pagarmePlanId?: string | null;
  maxBarbers?: number | null;
  maxAdmins?: number | null;
  maxReceptionists?: number | null;
  isPublic?: boolean;
  isRecommended?: boolean;
  sortOrder?: number;
  active?: boolean;
  platform_plan_features?: string[];
}) {
  return prisma.$transaction(async (tx: any) => {
    const plan = await tx.platform_plans.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        interval: data.interval ?? 'month',
        interval_count: data.intervalCount ?? 1,
        trial_period_days: data.trialPeriodDays ?? 0,
        pagarme_plan_id: data.pagarmePlanId ?? null,
        max_barbers: data.maxBarbers ?? null,
        max_admins: data.maxAdmins ?? null,
        max_receptionists: data.maxReceptionists ?? null,
        is_public: data.isPublic ?? false,
        is_recommended: data.isRecommended ?? false,
        sort_order: data.sortOrder ?? 0,
        active: data.active ?? true,
      },
    });

    if (data.platform_plan_features && data.platform_plan_features.length > 0) {
      // await tx.platform_plan_platform_plan_features.createMany({
      await tx.platform_plan_features.createMany({
        data: data.platform_plan_features.map((f, i) => ({
          plan_id: plan.id,
          feature: f,
          sort_order: i,
        })),
      });
    }

    return tx.platform_plans.findUnique({
      where: { id: plan.id },
      include: { platform_plan_features: { orderBy: { sort_order: 'asc' } } },
    });
  });
}

export async function updatePlatformPlanInDB(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    price?: number;
    interval?: string;
    intervalCount?: number;
    trialPeriodDays?: number;
    pagarmePlanId?: string | null;
    maxBarbers?: number | null;
    maxAdmins?: number | null;
    maxReceptionists?: number | null;
    isPublic?: boolean;
    isRecommended?: boolean;
    sortOrder?: number;
    active?: boolean;
    platform_plan_features?: string[];
  }
) {
  const existing = await prisma.platform_plans.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.$transaction(async (tx: any) => {
    const updateData: any = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.interval !== undefined) updateData.interval = data.interval;
    if (data.intervalCount !== undefined) updateData.interval_count = data.intervalCount;
    if (data.trialPeriodDays !== undefined) updateData.trial_period_days = data.trialPeriodDays;
    if (data.pagarmePlanId !== undefined) updateData.pagarme_plan_id = data.pagarmePlanId;
    if (data.maxBarbers !== undefined) updateData.max_barbers = data.maxBarbers;
    if (data.maxAdmins !== undefined) updateData.max_admins = data.maxAdmins;
    if (data.maxReceptionists !== undefined) updateData.max_receptionists = data.maxReceptionists;
    if (data.isPublic !== undefined) updateData.is_public = data.isPublic;
    if (data.isRecommended !== undefined) updateData.is_recommended = data.isRecommended;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
    if (data.active !== undefined) updateData.active = data.active;

    await tx.platform_plans.update({ where: { id }, data: updateData });

    if (data.platform_plan_features !== undefined) {
      // await tx.platform_plan_platform_plan_features.deleteMany({ where: { plan_id: id } });
      await tx.platform_plan_features.deleteMany({ where: { plan_id: id } });
      if (data.platform_plan_features.length > 0) {
        await tx.platform_plan_platform_plan_features.createMany({
          data: data.platform_plan_features.map((f, i) => ({
            plan_id: id,
            feature: f,
            sort_order: i,
          })),
        });
      }
    }

    return tx.platform_plans.findUnique({
      where: { id },
      include: { platform_plan_features: { orderBy: { sort_order: 'asc' } } },
    });
  });
}

export async function deletePlatformPlanFromDB(id: string) {
  const existing = await prisma.platform_plans.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.$transaction(async (tx: any) => {
    // Desvincula assinaturas que referenciam este plano antes de deletar
    await tx.barbershop_platform_subscriptions.updateMany({
      where: { platform_plan_id: id },
      data: { platform_plan_id: null },
    });

    await tx.platform_plans.delete({ where: { id } });
    return existing;
  });
}
