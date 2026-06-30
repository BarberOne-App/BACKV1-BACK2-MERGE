import { Request, Response } from "express";
import {
  CreateProductSchema,
  CreateProductStockMovementSchema,
  ImportProductsSchema,
  ListProductStockMovementsQuerySchema,
  ListProductsQuerySchema,
  UpdateProductSchema,
} from "../models/productSchemas.js";
import {
  createProductStockMovementService,
  createProductService,
  deleteProductService,
  getProductByIdService,
  importProductsService,
  listProductStockMovementsService,
  listProductsService,
  reactivateProductService,
  updateProductService,
} from "../services/productsService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function createProduct(req: Request, res: Response) {
  const { error } = CreateProductSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createProductService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    data: req.body,
  });

  return res.status(201).send(result);
}

export async function importProducts(req: Request, res: Response) {
  const { error, value } = ImportProductsSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await importProductsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    rows: value.rows,
  });

  return res.status(201).send(result);
}

export async function listProducts(req: Request, res: Response) {
  const { error } = ListProductsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const active =
    typeof req.query.active === "string"
      ? req.query.active === "true"
      : undefined;

  const category =
    typeof req.query.category === "string" ? req.query.category : undefined;

  const q = typeof req.query.q === "string" ? req.query.q : undefined;

  const result = await listProductsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    query: { active, category, q },
  });

  return res.status(200).send(result);
}

export async function getProductById(req: Request, res: Response) {
  const { id } = req.params;

  const result = await getProductByIdService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    productId: id,
  });

  return res.status(200).send(result);
}

export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params;

  const { error } = UpdateProductSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await updateProductService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    productId: id,
    data: req.body,
  });

  return res.status(200).send(result);
}

export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params;

  const result = await deleteProductService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    productId: id,
  });

  return res.status(200).send(result);
}

export async function reactivateProduct(req: Request, res: Response) {
  const { id } = req.params;

  const result = await reactivateProductService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    productId: id,
  });

  return res.status(200).send(result);
}

export async function listProductStockMovements(req: Request, res: Response) {
  const { error } = ListProductStockMovementsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listProductStockMovementsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    query: {
      productId:
        typeof req.query.productId === "string" ? req.query.productId : undefined,
      type:
        req.query.type === "entry" || req.query.type === "exit"
          ? req.query.type
          : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      limit:
        typeof req.query.limit === "string"
          ? Number(req.query.limit)
          : undefined,
    },
  });

  return res.status(200).send(result);
}

export async function createProductStockMovement(req: Request, res: Response) {
  const { error, value } = CreateProductStockMovementSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createProductStockMovementService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    actorRole: req.user!.role as "admin" | "barber" | "client",
    data: value,
  });

  return res.status(201).send(result);
}
