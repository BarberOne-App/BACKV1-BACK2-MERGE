import { Request, Response } from "express";
import {
  CreateEmployeePaymentSchema,
  CreateExtraEmployeePaymentSchema,
} from "../models/employeePaymentSchemas.js";
import {
  createEmployeePaymentService,
  createExtraEmployeePaymentService,
  getEmployeePayrollSummaryService,
  getMyPayrollSummaryService,
  listEmployeePaymentsService,
  listExtraEmployeePaymentsService,
} from "../services/employeePaymentService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listEmployeePayments(req: Request, res: Response) {
  try {
    const result = await listEmployeePaymentsService({
      barbershopId: req.user!.barbershopId,
      actorRole: req.user!.role,
      actorId: req.user!.id,
      isAdmin: req.user!.isAdmin,
    });

    return res.status(200).send(result);
  } catch (err: any) {
    console.error("Erro ao listar pagamentos:", err);

    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao listar pagamentos",
    });
  }
}

/* ───── CREATE ───── */
export async function createEmployeePayment(req: Request, res: Response) {
  try {
    const { error, value } = CreateEmployeePaymentSchema.validate(req.body);

    if (error) {
      return res.status(422).send(joiErrors(error));
    }

    const result = await createEmployeePaymentService({
      barbershopId: req.user!.barbershopId,
      actorId: req.user!.id,
      data: value,
    });

    return res.status(201).send(result);
  } catch (err: any) {
    console.error("Erro ao criar pagamento:", err);

    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao criar pagamento",
    });
  }
}

/* ───── MY SUMMARY (own barber data, no admin required) ───── */

export async function getMyPayrollSummary(req: Request, res: Response) {
  try {
    const { periodStart, periodEnd } = req.query as Record<string, string>;

    if (!periodStart || !periodEnd) {
      return res.status(422).send({ message: "periodStart e periodEnd são obrigatórios" });
    }

    const result = await getMyPayrollSummaryService({
      barbershopId: req.user!.barbershopId,
      userId: req.user!.id,
      periodStart,
      periodEnd,
    });

    return res.status(200).send(result);
  } catch (err: any) {
    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao carregar resumo de ganhos",
    });
  }
}

/* ───── EXTRA PAYMENTS ───── */

export async function listExtraEmployeePayments(req: Request, res: Response) {
  try {
    const result = await listExtraEmployeePaymentsService({
      barbershopId: req.user!.barbershopId,
      actorRole: req.user!.role,
      isAdmin: req.user!.isAdmin,
    });
    return res.status(200).send(result);
  } catch (err: any) {
    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao listar pagamentos extras",
    });
  }
}

export async function createExtraEmployeePayment(req: Request, res: Response) {
  const { error, value } = CreateExtraEmployeePaymentSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  try {
    const result = await createExtraEmployeePaymentService({
      barbershopId: req.user!.barbershopId,
      actorId: req.user!.id,
      data: value,
    });
    return res.status(201).send(result);
  } catch (err: any) {
    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao registrar pagamento extra",
    });
  }
}

export async function getEmployeePayrollSummary(req: Request, res: Response) {
  try {
    const today = new Date();
    const defaultStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
    const defaultEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);

    const result = await getEmployeePayrollSummaryService({
      barbershopId: req.user!.barbershopId,
      actorRole: req.user!.role,
      isAdmin: req.user!.isAdmin,
      periodStart: String(req.query.periodStart || defaultStart),
      periodEnd: String(req.query.periodEnd || defaultEnd),
      employeeId: req.query.employeeId ? String(req.query.employeeId) : undefined,
      role: req.query.role ? String(req.query.role) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
    });

    return res.status(200).send(result);
  } catch (err: any) {
    console.error("Erro ao resumir pagamentos:", err);

    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao resumir pagamentos",
    });
  }
}
