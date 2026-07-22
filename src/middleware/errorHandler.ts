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

import fs from 'fs';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  try {
    fs.appendFileSync('error.log', new Date().toISOString() + ' - ' + (err.stack || err.message || JSON.stringify(err)) + '\n');
    if (err.details) {
      fs.appendFileSync('error.log', 'Details: ' + JSON.stringify(err.details) + '\n');
    }
  } catch (e) {}

  // erro “controlado”
  if (err instanceof AppError) {
    return res.status(err.status).send([err.message]);
  }

  // erros conhecidos do Prisma (ex: unique)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).send(["Dados já cadastrados (unique)"]);

    const databaseError = String(err.meta?.database_error ?? err.message ?? "");
    const isAppointmentOverlap =
      err.code === "P2004" &&
      (databaseError.includes("23P01") ||
        databaseError.includes("appointments_no_barber_overlap") ||
        databaseError.includes("appointments_no_client_overlap") ||
        databaseError.includes("appointments_no_dependent_overlap"));

    if (isAppointmentOverlap) {
      return res.status(409).send([
        "Este horário já está ocupado para o barbeiro, cliente ou dependente",
      ]);
    }
  }

  // Erro da API do Pagar.me ou outro serviço com status numérico
  if (err && typeof err.status === 'number') {
    console.error('Erro na API externa (Pagar.me):', err);
    return res.status(err.status).send([err.message || 'Erro na API externa']);
  }

  console.error('ERRO COMPLETO:', err);
  console.error('STACK:', err?.stack);

  if (err?.response?.data) {
    console.error(
      'PAGARME RESPONSE:',
      JSON.stringify(err.response.data, null, 2)
    );
  }

  return res.status(500).json({
    error: err?.message || 'Erro interno',
    details: err?.response?.data || err?.details,
    stack: err?.stack
  });
}
