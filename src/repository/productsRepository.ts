import prisma from "../database/database.js";
import { Prisma, type PrismaClient } from "@prisma/client";

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

export type ProductStockMovementType = "entry" | "exit";

export interface ProductStockMovementRow {
  id: string;
  product_id: string;
  product_name: string;
  product_legacy_id: string | null;
  barbershop_id: string;
  type: ProductStockMovementType;
  quantity: number;
  purchase_price: Prisma.Decimal | number | string | null;
  sale_price: Prisma.Decimal | number | string | null;
  occurred_at: Date;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
  stock_after: number;
}

export async function listProductStockMovementsInBarbershop(params: {
  barbershopId: string;
  productId?: string;
  type?: ProductStockMovementType;
  q?: string;
  limit?: number;
}) {
  const byProduct = params.productId
    ? Prisma.sql`AND m.product_id = ${params.productId}::uuid`
    : Prisma.empty;
  const byType = params.type ? Prisma.sql`AND m.type = ${params.type}` : Prisma.empty;
  const byQuery = params.q
    ? Prisma.sql`AND (p.name ILIKE ${`%${params.q}%`} OR p.legacy_id ILIKE ${`%${params.q}%`})`
    : Prisma.empty;

  return prisma.$queryRaw<ProductStockMovementRow[]>`
    SELECT
      m.id::text,
      m.product_id::text,
      p.name AS product_name,
      p.legacy_id AS product_legacy_id,
      m.barbershop_id::text,
      m.type,
      m.quantity,
      m.purchase_price,
      m.sale_price,
      m.stock_after,
      m.occurred_at,
      m.note,
      m.created_by::text,
      u.name AS created_by_name,
      m.created_at
    FROM product_stock_movements m
    INNER JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.barbershop_id = ${params.barbershopId}::uuid
      ${byProduct}
      ${byType}
      ${byQuery}
    ORDER BY m.occurred_at DESC, m.created_at DESC
    LIMIT ${params.limit ?? 50}
  `;
}

export async function createProductStockMovement(params: {
  barbershopId: string;
  actorId: string;
  productId: string;
  type: ProductStockMovementType;
  quantity: number;
  purchasePrice?: Prisma.Decimal | null;
  salePrice?: Prisma.Decimal | null;
  occurredAt: Date;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const product = await findProductByIdInBarbershop(
      params.barbershopId,
      params.productId,
      tx
    );

    if (!product) return null;

    const nextStock =
      params.type === "entry"
        ? product.stock + params.quantity
        : product.stock - params.quantity;

    if (nextStock < 0) {
      return {
        product,
        movement: null,
        insufficientStock: true,
      };
    }

    const updatedProduct = await tx.products.update({
      where: { id: params.productId },
      data: {
        stock: nextStock,
        updated_at: new Date(),
      },
    });

    const rows = await tx.$queryRaw<ProductStockMovementRow[]>`
      INSERT INTO product_stock_movements (
        product_id,
        barbershop_id,
        type,
        quantity,
        purchase_price,
        sale_price,
        stock_after,
        occurred_at,
        note,
        created_by
      )
      VALUES (
        ${params.productId}::uuid,
        ${params.barbershopId}::uuid,
        ${params.type},
        ${params.quantity},
        ${params.purchasePrice ?? null},
        ${params.salePrice ?? null},
        ${updatedProduct.stock},
        ${params.occurredAt},
        ${params.note ?? null},
        ${params.actorId}::uuid
      )
      RETURNING
        id::text,
        product_id::text,
        ${updatedProduct.name} AS product_name,
        ${updatedProduct.legacy_id} AS product_legacy_id,
        barbershop_id::text,
        type,
        quantity,
        purchase_price,
        sale_price,
        stock_after,
        occurred_at,
        note,
        created_by::text,
        NULL::text AS created_by_name,
        created_at
    `;

    return {
      product: updatedProduct,
      movement: rows[0],
      insufficientStock: false,
    };
  });
}
