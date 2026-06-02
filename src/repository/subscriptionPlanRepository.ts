import prisma from "../database/database.js";

/* ───── LIST ───── */
export async function listPlansInBarbershop(params: {
  barbershopId: string;
  activeOnly?: boolean;
}) {
  const where: any = { barbershop_id: params.barbershopId };
  if (params.activeOnly) where.active = true;

  return prisma.subscription_plans.findMany({
    where,
    orderBy: { price: "asc" },
    include: {
      subscription_plan_features: {
        orderBy: { sort_order: "asc" },
      },
    },
  });
}

/* ───── GET BY ID ───── */
export async function findPlanByIdInBarbershop(
  barbershopId: string,
  id: string
) {
  return prisma.subscription_plans.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: {
      subscription_plan_features: {
        orderBy: { sort_order: "asc" },
      },
    },
  });
}

/* ───── CREATE (plan + features em transação) ───── */
export async function createPlanInBarbershop(data: {
  barbershopId: string;
  name: string;
  subtitle?: string | null;
  price: number;
  color?: string | null;
  cutsPerMonth: number;
  active?: boolean;
  recommended?: boolean;
  features?: string[];
  maxBarbers?: number | null;
  maxReceptionists?: number | null;
  maxAdmins?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscription_plans.create({
      data: {
        barbershop_id: data.barbershopId,
        name: data.name,
        subtitle: data.subtitle ?? null,
        price: data.price,
        color: data.color ?? null,
        cuts_per_month: data.cutsPerMonth,
        max_barbers: data.maxBarbers ?? null,
        max_receptionists: data.maxReceptionists ?? null,
        max_admins: data.maxAdmins ?? null,
        active: data.active ?? true,
        recommended: data.recommended ?? false,
      },
    });

    if (data.features && data.features.length > 0) {
      await tx.subscription_plan_features.createMany({
        data: data.features.map((f, i) => ({
          plan_id: plan.id,
          feature: f,
          sort_order: i,
        })),
      });
    }

    return tx.subscription_plans.findUnique({
      where: { id: plan.id },
      include: {
        subscription_plan_features: { orderBy: { sort_order: "asc" } },
      },
    });
  });
}

/* ───── UPDATE (plan + replace features) ───── */
export async function updatePlanInBarbershop(
  barbershopId: string,
  id: string,
  data: {
    name?: string;
    subtitle?: string | null;
    price?: number;
    color?: string | null;
    cutsPerMonth?: number;
    active?: boolean;
    recommended?: boolean;
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
  }
) {
  const existing = await prisma.subscription_plans.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.cutsPerMonth !== undefined) updateData.cuts_per_month = data.cutsPerMonth;
    if (data.maxBarbers !== undefined) updateData.max_barbers = data.maxBarbers;
    if (data.maxReceptionists !== undefined) updateData.max_receptionists = data.maxReceptionists;
    if (data.maxAdmins !== undefined) updateData.max_admins = data.maxAdmins;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.recommended !== undefined) updateData.recommended = data.recommended;
    updateData.updated_at = new Date();

    await tx.subscription_plans.update({
      where: { id },
      data: updateData,
    });

    if (data.features !== undefined) {
      await tx.subscription_plan_features.deleteMany({ where: { plan_id: id } });
      if (data.features.length > 0) {
        await tx.subscription_plan_features.createMany({
          data: data.features.map((f, i) => ({
            plan_id: id,
            feature: f,
            sort_order: i,
          })),
        });
      }
    }

    return tx.subscription_plans.findUnique({
      where: { id },
      include: {
        subscription_plan_features: { orderBy: { sort_order: "asc" } },
      },
    });
  });
}

/* ───── DELETE ───── */
export async function deletePlanFromBarbershop(barbershopId: string, id: string) {
  const existing = await prisma.subscription_plans.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  await prisma.subscription_plans.delete({ where: { id } });
  return existing;
}
