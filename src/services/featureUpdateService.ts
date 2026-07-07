import prisma from "../database/database.js";
import { notFound } from "../errors/index.js";

type FeatureUpdatePayload = {
  title: string;
  description: string;
  active: boolean;
};

function serializeFeatureUpdate(update: any) {
  return {
    id: update.id,
    title: update.title,
    description: update.description,
    active: update.active,
    createdAt: update.created_at,
    updatedAt: update.updated_at,
  };
}

export async function listFeatureUpdatesService(params: { activeOnly?: boolean } = {}) {
  const updates = await prisma.feature_updates.findMany({
    where: params.activeOnly ? { active: true } : undefined,
    orderBy: { created_at: "desc" },
  });

  return updates.map(serializeFeatureUpdate);
}

export async function createFeatureUpdateService(data: FeatureUpdatePayload) {
  const update = await prisma.feature_updates.create({
    data: {
      title: data.title,
      description: data.description,
      active: data.active,
    },
  });

  return serializeFeatureUpdate(update);
}

export async function updateFeatureUpdateService(id: string, data: FeatureUpdatePayload) {
  const existing = await prisma.feature_updates.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) throw notFound("Atualizacao de funcionalidade nao encontrada");

  const update = await prisma.feature_updates.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      active: data.active,
      updated_at: new Date(),
    },
  });

  return serializeFeatureUpdate(update);
}

export async function deleteFeatureUpdateService(id: string) {
  const existing = await prisma.feature_updates.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) throw notFound("Atualizacao de funcionalidade nao encontrada");

  await prisma.feature_updates.delete({ where: { id } });
}
