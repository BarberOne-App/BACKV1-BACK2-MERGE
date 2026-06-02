import prisma from "../database/database.js";
import type { Prisma, PrismaClient } from "@prisma/client";

type DB = PrismaClient | Prisma.TransactionClient;

function dbClient(tx?: Prisma.TransactionClient): DB {
  return (tx ?? prisma) as DB;
}

export async function createProduct(
  data: {
    barbershopId: string;
    name: string;
    description?: string | null;
    category?: string | null;
    price: Prisma.Decimal;
    subscriberDiscount?: number;
    imageUrl?: string | null;
    stock?: number;
    active?: boolean;
  },
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  return db.products.create({
    data: {
      barbershop_id: data.barbershopId,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      price: data.price,
      subscriber_discount: data.subscriberDiscount ?? 0,
      image_url: data.imageUrl ?? null,
      stock: data.stock ?? 0,
      active: data.active ?? true,
    },
  });
}

export async function findProductByIdInBarbershop(
  barbershopId: string,
  productId: string,
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  return db.products.findFirst({
    where: {
      id: productId,
      barbershop_id: barbershopId,
    },
  });
}

export async function listProductsInBarbershop(
  params: {
    barbershopId: string;
    active?: boolean;
    category?: string;
    q?: string;
  },
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  const where: Prisma.productsWhereInput = {
    barbershop_id: params.barbershopId,
  };

  if (typeof params.active === "boolean") {
    where.active = params.active;
  }

  if (params.category) {
    where.category = params.category;
  }

  if (params.q) {
    where.name = {
      contains: params.q,
      mode: "insensitive",
    };
  }

  return db.products.findMany({
    where,
    orderBy: { created_at: "desc" },
  });
}

export async function updateProductInBarbershop(
  barbershopId: string,
  productId: string,
  data: Prisma.productsUpdateInput,
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  const existing = await findProductByIdInBarbershop(
    barbershopId,
    productId,
    tx
  );

  if (!existing) return null;

  return db.products.update({
    where: { id: productId },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function deleteProductById(
  barbershopId: string,
  productId: string,
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  const existing = await findProductByIdInBarbershop(
    barbershopId,
    productId,
    tx
  );

  if (!existing) return null;

  const deactivated = await db.products.update({
    where: { id: productId },
    data: {
      active: false,
      updated_at: new Date(),
    },
  });

  return {
    product: deactivated,
    deletedHard: false,
  };
}

export async function reactivateProductById(
  barbershopId: string,
  productId: string,
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  const existing = await findProductByIdInBarbershop(
    barbershopId,
    productId,
    tx
  );

  if (!existing) return null;

  return db.products.update({
    where: { id: productId },
    data: {
      active: true,
      updated_at: new Date(),
    },
  });
}

export async function countAppointmentProductUsages(
  productId: string,
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);

  return db.appointment_products.count({
    where: { product_id: productId },
  });
}