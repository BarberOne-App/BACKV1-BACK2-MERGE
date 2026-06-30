import { Prisma } from "@prisma/client";
import { badRequest, forbidden, notFound } from "../errors/index.js";
import {
  createProductStockMovement,
  createProduct,
  deleteProductById,
  findProductByIdInBarbershop,
  listProductStockMovementsInBarbershop,
  listProductsInBarbershop,
  reactivateProductById,
  updateProductInBarbershop,
  type ProductStockMovementType,
} from "../repository/productsRepository.js";

function decimalToNumber(value: any) {
  if (value == null) return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value?.toNumber === "function") return value.toNumber();
  return Number(value);
}

function serializeProduct(product: any) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: decimalToNumber(product.price),
    subscriberDiscount:
      product.subscriberDiscount ?? product.subscriber_discount ?? 0,
    subscriber_discount:
      product.subscriber_discount ?? product.subscriberDiscount ?? 0,
    imageUrl: product.imageUrl ?? product.image_url ?? null,
    image_url: product.image_url ?? product.imageUrl ?? null,
    stock: product.stock,
    active: product.active,
    createdAt: product.created_at ?? product.createdAt,
    updatedAt: product.updated_at ?? product.updatedAt,
    barbershopId: product.barbershop_id ?? product.barbershopId,
  };
}

function getProductCode(productId: string, legacyId?: string | null) {
  return legacyId || productId.slice(0, 8).toUpperCase();
}

function serializeProductStockMovement(row: any) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productCode: getProductCode(row.product_id, row.product_legacy_id),
    barbershopId: row.barbershop_id,
    type: row.type,
    quantity: row.quantity,
    purchasePrice: decimalToNumber(row.purchase_price),
    salePrice: decimalToNumber(row.sale_price),
    occurredAt: row.occurred_at,
    note: row.note,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    stockAfter: row.stock_after,
  };
}

export async function createProductService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  data: {
    name: string;
    description?: string | null;
    category?: string | null;
    price: number;
    subscriberDiscount?: number;
    imageUrl?: string | null;
    stock?: number;
    active?: boolean;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode criar produto");
  }

  const created = await createProduct({
    barbershopId: params.barbershopId,
    name: params.data.name.trim(),
    description: params.data.description ?? null,
    category: params.data.category ?? null,
    price: new Prisma.Decimal(params.data.price),
    subscriberDiscount: params.data.subscriberDiscount ?? 0,
    imageUrl: params.data.imageUrl ?? null,
    stock: params.data.stock ?? 0,
    active: params.data.active ?? true,
  });

  return serializeProduct(created);
}

export async function importProductsService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  rows: Array<{
    name: string;
    description?: string | null;
    category?: string | null;
    price: number;
    subscriberDiscount?: number;
    imageUrl?: string | null;
    stock?: number;
    active?: boolean;
  }>;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode importar produto");
  }

  const created: any[] = [];
  const errors: Array<{ row: number; name?: string; message: string }> = [];

  for (let i = 0; i < params.rows.length; i += 1) {
    const rowIndex = i + 1;
    const row = params.rows[i];

    try {
      const product = await createProductService({
        barbershopId: params.barbershopId,
        actorRole: "admin",
        data: {
          name: row.name,
          description: row.description ?? null,
          category: row.category ?? null,
          price: row.price,
          subscriberDiscount: row.subscriberDiscount ?? 0,
          imageUrl: row.imageUrl ?? null,
          stock: row.stock ?? 0,
          active: row.active ?? true,
        },
      });

      created.push(product);
    } catch (error: any) {
      errors.push({
        row: rowIndex,
        name: row.name,
        message: error?.message || "Erro ao criar produto",
      });
    }
  }

  return {
    createdCount: created.length,
    failedCount: errors.length,
    created,
    errors,
  };
}

export async function listProductsService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  query?: { active?: boolean; category?: string; q?: string };
}) {
  const active =
    params.actorRole === "admin" ? params.query?.active : true;

  const products = await listProductsInBarbershop({
    barbershopId: params.barbershopId,
    active,
    category: params.query?.category,
    q: params.query?.q,
  });

  return products.map(serializeProduct);
}

export async function getProductByIdService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  productId: string;
}) {
  const product = await findProductByIdInBarbershop(
    params.barbershopId,
    params.productId
  );

  if (!product) throw notFound("Produto não encontrado");

  if (params.actorRole !== "admin" && !product.active) {
    throw notFound("Produto não encontrado");
  }

  return serializeProduct(product);
}

export async function updateProductService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  productId: string;
  data: {
    name?: string;
    description?: string | null;
    category?: string | null;
    price?: number;
    subscriberDiscount?: number;
    imageUrl?: string | null;
    stock?: number;
    active?: boolean;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode editar produto");
  }

  const existing = await findProductByIdInBarbershop(
    params.barbershopId,
    params.productId
  );

  if (!existing) throw notFound("Produto não encontrado");

  const data: Prisma.productsUpdateInput = {};

  if (params.data.name !== undefined) data.name = params.data.name.trim();
  if (params.data.description !== undefined) {
    data.description = params.data.description ?? null;
  }
  if (params.data.category !== undefined) {
    data.category = params.data.category ?? null;
  }
  if (params.data.price !== undefined) {
    data.price = new Prisma.Decimal(params.data.price);
  }
  if (params.data.subscriberDiscount !== undefined) {
    data.subscriber_discount = params.data.subscriberDiscount;
  }
  if (params.data.imageUrl !== undefined) {
    data.image_url = params.data.imageUrl ?? null;
  }
  if (params.data.stock !== undefined) {
    data.stock = params.data.stock;
  }
  if (params.data.active !== undefined) {
    data.active = params.data.active;
  }

  const updated = await updateProductInBarbershop(
    params.barbershopId,
    params.productId,
    data
  );

  if (!updated) throw notFound("Produto não encontrado");

  return serializeProduct(updated);
}

export async function deleteProductService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  productId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode remover produto");
  }

  const existing = await findProductByIdInBarbershop(
    params.barbershopId,
    params.productId
  );

  if (!existing) throw notFound("Produto não encontrado");

  const result = await deleteProductById(
    params.barbershopId,
    params.productId
  );

  if (!result) throw notFound("Produto não encontrado");

  return {
    ok: true,
    product: serializeProduct(result.product),
    deletedHard: false,
    reason: "Produto desativado com sucesso",
  };
}

export async function reactivateProductService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  productId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode reativar produto");
  }

  const existing = await findProductByIdInBarbershop(
    params.barbershopId,
    params.productId
  );

  if (!existing) throw notFound("Produto não encontrado");

  const reactivated = await reactivateProductById(
    params.barbershopId,
    params.productId
  );

  if (!reactivated) throw notFound("Produto não encontrado");

  return {
    ok: true,
    product: serializeProduct(reactivated),
    reason: "Produto reativado com sucesso",
  };
}

export async function listProductStockMovementsService(params: {
  barbershopId: string;
  actorRole: "admin" | "barber" | "client";
  query?: {
    productId?: string;
    type?: ProductStockMovementType;
    q?: string;
    limit?: number;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode acessar estoque");
  }

  const movements = await listProductStockMovementsInBarbershop({
    barbershopId: params.barbershopId,
    productId: params.query?.productId,
    type: params.query?.type,
    q: params.query?.q,
    limit: params.query?.limit,
  });

  return movements.map(serializeProductStockMovement);
}

export async function createProductStockMovementService(params: {
  barbershopId: string;
  actorId: string;
  actorRole: "admin" | "barber" | "client";
  data: {
    productId: string;
    type: ProductStockMovementType;
    quantity: number;
    purchasePrice?: number | null;
    salePrice?: number | null;
    occurredAt?: string | Date;
    note?: string | null;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode registrar movimentacao de estoque");
  }

  const occurredAt = params.data.occurredAt
    ? new Date(params.data.occurredAt)
    : new Date();

  if (Number.isNaN(occurredAt.getTime())) {
    throw badRequest("Data da movimentacao invalida");
  }

  const result = await createProductStockMovement({
    barbershopId: params.barbershopId,
    actorId: params.actorId,
    productId: params.data.productId,
    type: params.data.type,
    quantity: params.data.quantity,
    purchasePrice:
      params.data.purchasePrice == null
        ? null
        : new Prisma.Decimal(params.data.purchasePrice),
    salePrice:
      params.data.salePrice == null
        ? null
        : new Prisma.Decimal(params.data.salePrice),
    occurredAt,
    note: params.data.note?.trim() || null,
  });

  if (!result) throw notFound("Produto nao encontrado");
  if (result.insufficientStock) {
    throw badRequest("Estoque insuficiente para registrar esta saida");
  }
  if (!result.movement) throw badRequest("Nao foi possivel registrar movimentacao");

  return {
    product: serializeProduct(result.product),
    movement: serializeProductStockMovement(result.movement),
  };
}
