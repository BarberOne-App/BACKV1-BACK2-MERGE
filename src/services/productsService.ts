import { Prisma } from "@prisma/client";
import { forbidden, notFound } from "../errors/index.js";
import {
  createProduct,
  deleteProductById,
  findProductByIdInBarbershop,
  listProductsInBarbershop,
  reactivateProductById,
  updateProductInBarbershop,
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