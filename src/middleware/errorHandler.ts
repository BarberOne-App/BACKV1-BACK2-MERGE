// import { Request, Response, NextFunction } from 'express';

// export class AppError extends Error {
//   constructor(
//     public statusCode: number,
//     public message: string
//   ) {
//     super(message);
//     Object.setPrototypeOf(this, AppError.prototype);
//   }
// }

// export const errorHandler = (
//   err: Error | AppError,
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   if (err instanceof AppError) {
//     return res.status(err.statusCode).json({
//       status: 'error',
//       statusCode: err.statusCode,
//       message: err.message,
//     });
//   }

//   console.error('❌ Erro inesperado:', err);

//   return res.status(500).json({
//     status: 'error',
//     statusCode: 500,
//     message: 'Erro interno do servidor',
//   });
// };


import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors/index.js";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // erro “controlado”
  if (err instanceof AppError) {
    return res.status(err.status).send([err.message]);
  }

  // erros conhecidos do Prisma (ex: unique)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).send(["Dados já cadastrados (unique)"]);
  }

  // Erro da API do Pagar.me ou outro serviço com status numérico
  if (err && typeof err.status === 'number') {
    console.error('Erro na API externa (Pagar.me):', err);
    return res.status(err.status).send([err.message || 'Erro na API externa']);
  }

  console.error(err);
  return res.status(500).send(["Erro interno"]);
}
