import { badRequest, forbidden, notFound } from "../errors/index.js";
import {
  createEmployeePayment,
  findEmployeePaymentByPeriod,
  findLastEmployeePayment,
  listCommissionAppointments,
  listEmployeePayments,
  listEmployeePaymentsByPeriod,
  listPayrollEmployees,
} from "../repository/employeePaymentRepository.js";
import { listEmployeeValesByPeriod } from "../repository/employeeValeRepository.js";
import { getHomeInfoByBarbershop } from "../repository/settingRepository.js";
import {
  calculateCommission,
  resolveServiceCommissionType,
} from "./commissionService.js";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function serialize(payment: any) {
  return {
    id: payment.id,
    employeeId: payment.employee_id,
    employeeName: payment.employee_name,
    period: payment.period,
    periodStart: payment.period_start,
    periodEnd: payment.period_end,
    salarioFixo: Number(payment.base_salary),
    baseSalary: Number(payment.base_salary),
    commission: Number(payment.commission),
    totalVales: Number(payment.total_vales),
    liquido: Number(payment.net_amount),
    netAmount: Number(payment.net_amount),
    paidAt: payment.paid_at,
    paidBy: payment.paid_by,
    paidByName: payment.creator?.name ?? null,
    createdAt: payment.created_at,
  };
}

function toDate(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function decimalToNumber(value: any) {
  if (value == null) return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value?.toNumber === "function"
        ? value.toNumber()
        : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePeriod(period?: string | null) {
  switch (period) {
    case "weekly":
      return "semanal";
    case "biweekly":
      return "quinzenal";
    case "monthly":
      return "mensal";
    default:
      return period || "mensal";
  }
}

function roleLabel(role: string, isAdmin?: boolean) {
  if (role === "barber") return "Barbeiro";
  if (role === "receptionist") return "Recepcionista";
  if (role === "admin" || isAdmin) return "Administrador";
  return role;
}

function serializeVale(vale: any) {
  const note = String(vale.note ?? "");
  const [descriptionLine, ...observationLines] = note.split("\n\n");
  const description = descriptionLine.replace(/^Motivo:\s*/i, "") || null;
  const observation =
    observationLines.join("\n\n").replace(/^Observacao:\s*/i, "") || null;

  return {
    id: vale.id,
    employeeId: vale.employee_id,
    employeeName: vale.employee?.name ?? null,
    valor: Number(vale.amount),
    descricao: description,
    motivo: description,
    observacao: observation,
    note: vale.note,
    data:
      typeof vale.date === "string"
        ? vale.date
        : (vale.date as Date).toISOString().slice(0, 10),
    createdAt: vale.created_at,
    createdBy: vale.created_by,
    createdByName: vale.creator?.name ?? null,
  };
}

function buildCommissionByEmployee(appointments: any[]) {
  const totals = new Map<
    string,
    { amount: number; services: number; appointments: number }
  >();

  console.log("[employee-payroll] commission appointments loaded", {
    appointmentsCount: appointments.length,
    appointmentIds: appointments.map((appointment) => appointment.id),
  });

  for (const appointment of appointments) {
    const employeeId = appointment.barbers?.user_id;
    if (!employeeId) {
      console.log("[employee-payroll] appointment skipped without employee user", {
        appointmentId: appointment.id,
        barberId: appointment.barber_id,
        barberName: appointment.barbers?.display_name,
      });
      continue;
    }

    const current = totals.get(employeeId) ?? {
      amount: 0,
      services: 0,
      appointments: 0,
    };
    current.appointments += 1;

    for (const service of appointment.appointment_services ?? []) {
      const unitPrice = Number(service.unit_price) || 0;
      const quantity = Number(service.quantity) || 1;
      const amount = unitPrice * quantity;
      const serviceCommissionPercent = decimalToNumber(service.services?.comission_percent);
      const barberCommissionPercent = decimalToNumber(appointment.barbers?.commission_percent);
      const commissionPercent = serviceCommissionPercent ?? barberCommissionPercent;
      const commissionType = resolveServiceCommissionType({
        coveredByPlan: service.services?.covered_by_plan,
        commissionPercent,
        serviceName: service.service_name,
      });
      const commissionAmount = calculateCommission({
        amount,
        type: commissionType,
        commissionPercent,
      });

      console.log("[employee-payroll] commission service item", {
        appointmentId: appointment.id,
        appointmentStartAt: appointment.start_at,
        employeeId,
        barberId: appointment.barber_id,
        barberName: appointment.barbers?.display_name,
        serviceId: service.id,
        serviceName: service.service_name,
        unitPrice,
        quantity,
        amount,
        serviceCommissionPercent,
        barberCommissionPercent,
        effectiveCommissionPercent: commissionPercent,
        fallbackCommissionType: commissionType,
        commissionAmount,
      });

      current.amount += commissionAmount;
      current.services += quantity;
    }

    console.log("[employee-payroll] employee commission running total", {
      employeeId,
      appointmentId: appointment.id,
      runningCommissionAmount: roundMoney(current.amount),
      runningServices: current.services,
      runningAppointments: current.appointments,
    });

    totals.set(employeeId, current);
  }

  console.log(
    "[employee-payroll] commission totals by employee",
    Array.from(totals.entries()).map(([employeeId, total]) => ({
      employeeId,
      amount: roundMoney(total.amount),
      services: total.services,
      appointments: total.appointments,
    }))
  );

  return totals;
}

function isExtraEmployeePayment(p: any): boolean {
  return (
    p.period_start === p.period_end &&
    Number(p.commission) === 0 &&
    Number(p.total_vales) === 0 &&
    Number(p.base_salary) > 0
  );
}

export async function listExtraEmployeePaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  isAdmin?: boolean;
}) {
  const canAccess =
    params.actorRole === "admin" ||
    params.isAdmin ||
    params.actorRole === "super_admin";

  if (!canAccess) throw forbidden("Apenas admin pode acessar pagamentos extras de funcionarios");

  const allPayments = await listEmployeePayments(params.barbershopId);
  const extraPayments = allPayments.filter(isExtraEmployeePayment);
  return extraPayments.map(serialize);
}

export async function createExtraEmployeePaymentService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    employeeId: string;
    amount: number;
    date: string;
  };
}) {
  const employees = await listPayrollEmployees({
    barbershopId: params.barbershopId,
    employeeId: params.data.employeeId,
  });

  if (!employees || employees.length === 0) {
    throw notFound("Funcionario nao encontrado");
  }

  const employee = employees[0];

  const created = await createEmployeePayment({
    employeeId: params.data.employeeId,
    employeeName: employee.name,
    period: "mensal",
    periodStart: params.data.date,
    periodEnd: params.data.date,
    baseSalary: params.data.amount,
    commission: 0,
    totalVales: 0,
    netAmount: params.data.amount,
    paidBy: params.actorId,
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}

/* ── MY SUMMARY (barber sees their own data without admin check) ── */
export async function getMyPayrollSummaryService(params: {
  barbershopId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
}) {
  return getEmployeePayrollSummaryService({
    barbershopId: params.barbershopId,
    actorRole: "admin",
    isAdmin: true,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    employeeId: params.userId,
  });
}

export async function syncEmployeeCommissionFromAppointmentPayment(_params: {
  barbershopId: string;
  appointmentId: string;
  paidAt?: Date | null;
  actorId?: string | null;
}) {
  return null;
}

export async function getEmployeePayrollSummaryService(params: {
  barbershopId: string;
  actorRole: string;
  isAdmin?: boolean;
  periodStart: string;
  periodEnd: string;
  employeeId?: string;
  role?: string;
  status?: string;
}) {
  const canAccess =
    params.actorRole === "admin" ||
    params.isAdmin ||
    params.actorRole === "super_admin";

  if (!canAccess) throw forbidden("Apenas admin pode acessar pagamento de funcionarios");
  if (!params.barbershopId) throw badRequest("Barbearia ativa nao encontrada");

  const periodStartDate = toDate(params.periodStart);
  const periodEndDate = toDate(params.periodEnd, true);

  if (
    Number.isNaN(periodStartDate.getTime()) ||
    Number.isNaN(periodEndDate.getTime())
  ) {
    throw badRequest("Periodo invalido");
  }

  const [employees, appointments, vales, payments, paymentHistory] = await Promise.all([
    listPayrollEmployees({
      barbershopId: params.barbershopId,
      employeeId: params.employeeId,
      role: params.role,
    }),
    listCommissionAppointments({
      barbershopId: params.barbershopId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      employeeId: params.employeeId,
    }),
    listEmployeeValesByPeriod({
      barbershopId: params.barbershopId,
      employeeId: params.employeeId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
    }),
    listEmployeePaymentsByPeriod({
      barbershopId: params.barbershopId,
      employeeId: params.employeeId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    }),
    listEmployeePayments(params.barbershopId, params.employeeId),
  ]);

  console.log("[employee-payroll] summary input", {
    barbershopId: params.barbershopId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    employeeId: params.employeeId ?? null,
    role: params.role ?? null,
    status: params.status ?? null,
    employeesCount: employees.length,
    commissionAppointmentsCount: appointments.length,
    valesCount: vales.length,
    registeredPaymentsCount: payments.length,
    paymentHistoryCount: paymentHistory.length,
  });

  const commissionByEmployee = buildCommissionByEmployee(appointments);
  const valesByEmployee = new Map<string, any[]>();
  for (const vale of vales) {
    const list = valesByEmployee.get(vale.employee_id) ?? [];
    list.push(vale);
    valesByEmployee.set(vale.employee_id, list);
  }

  const paymentsByEmployee = new Map<string, any[]>();
  for (const payment of payments) {
    const list = paymentsByEmployee.get(payment.employee_id) ?? [];
    list.push(payment);
    paymentsByEmployee.set(payment.employee_id, list);
  }

  const paymentHistoryByEmployee = new Map<string, any[]>();
  for (const payment of paymentHistory) {
    const list = paymentHistoryByEmployee.get(payment.employee_id) ?? [];
    list.push(payment);
    paymentHistoryByEmployee.set(payment.employee_id, list);
  }

  const items = employees.map((employee) => {
    const barber = employee.barbers;
    const employeeVales = valesByEmployee.get(employee.id) ?? [];
    const employeePayments = paymentsByEmployee.get(employee.id) ?? [];
    const employeePaymentHistory = paymentHistoryByEmployee.get(employee.id) ?? [];
    const commissionInfo = commissionByEmployee.get(employee.id) ?? {
      amount: 0,
      services: 0,
      appointments: 0,
    };
    const baseSalary = Number(barber?.salary ?? employee.salary ?? 0);
    const commission = roundMoney(commissionInfo.amount);
    const totalVales = roundMoney(
      employeeVales.reduce((sum, vale) => sum + Number(vale.amount || 0), 0)
    );
    const grossAmount = roundMoney(baseSalary + commission);
    const netAmount = roundMoney(Math.max(grossAmount - totalVales, 0));
    const paidAmount = roundMoney(
      employeePayments.reduce(
        (sum, payment) => sum + Number(payment.net_amount || 0),
        0
      )
    );
    const amountDue = roundMoney(Math.max(netAmount - paidAmount, 0));
    const status =
      grossAmount <= 0
        ? "empty"
        : netAmount <= 0 || paidAmount >= netAmount
          ? "paid"
          : paidAmount > 0
            ? "partial"
            : "pending";

    console.log("[employee-payroll] employee summary row", {
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      baseSalary,
      commission,
      totalVales,
      grossAmount,
      netAmount,
      paidAmount,
      amountDue,
      status,
      appointmentsCount: commissionInfo.appointments,
      servicesCount: commissionInfo.services,
      valesIds: employeeVales.map((vale) => vale.id),
      paymentIds: employeePayments.map((payment) => payment.id),
      paymentHistoryIds: employeePaymentHistory.map((payment) => payment.id),
    });

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      photoUrl: employee.photo_url,
      role: employee.role,
      roleLabel: roleLabel(employee.role, employee.is_admin),
      functionType: barber?.specialty ?? roleLabel(employee.role, employee.is_admin),
      barberId: barber?.id ?? null,
      period: `${params.periodStart} a ${params.periodEnd}`,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      baseSalary,
      salarioFixo: baseSalary,
      commission,
      commissions: commission,
      totalVales,
      discounts: totalVales,
      grossAmount,
      totalToReceive: grossAmount,
      netAmount,
      liquido: netAmount,
      paidAmount,
      amountDue,
      status,
      paidAt: employeePaymentHistory[0]?.paid_at ?? employeePaymentHistory[0]?.created_at ?? null,
      paymentId: employeePaymentHistory[0]?.id ?? null,
      appointmentsCount: commissionInfo.appointments,
      servicesCount: commissionInfo.services,
      vales: employeeVales.map(serializeVale),
      payments: employeePayments.map(serialize),
      paymentHistory: employeePaymentHistory.map(serialize),
    };
  });

  const filteredItems =
    params.status && params.status !== "all"
      ? items.filter((item) => item.status === params.status)
      : items;

  const totals = filteredItems.reduce(
    (acc, item) => ({
      employees: acc.employees + 1,
      grossAmount: roundMoney(acc.grossAmount + item.grossAmount),
      commission: roundMoney(acc.commission + item.commission),
      totalVales: roundMoney(acc.totalVales + item.totalVales),
      netAmount: roundMoney(acc.netAmount + item.netAmount),
      paidAmount: roundMoney(acc.paidAmount + item.paidAmount),
      amountDue: roundMoney(acc.amountDue + item.amountDue),
      pending: acc.pending + (item.status === "pending" ? 1 : 0),
      partial: acc.partial + (item.status === "partial" ? 1 : 0),
      paid: acc.paid + (item.status === "paid" ? 1 : 0),
    }),
    {
      employees: 0,
      grossAmount: 0,
      commission: 0,
      totalVales: 0,
      netAmount: 0,
      paidAmount: 0,
      amountDue: 0,
      pending: 0,
      partial: 0,
      paid: 0,
    }
  );

  console.log("[employee-payroll] summary totals", {
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    totals,
    filteredEmployeeIds: filteredItems.map((item) => item.employeeId),
  });

  return {
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    totals,
    items: filteredItems,
  };
}

export async function listEmployeePaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  isAdmin?: boolean;
}) {
  const canAccess =
    params.actorRole === "admin" ||
    params.isAdmin ||
    params.actorRole === "super_admin";

  if (!canAccess) {
    throw forbidden("Sem permissao para listar pagamentos de funcionarios");
  }

  const items = await listEmployeePayments(params.barbershopId);

  return items.map(serialize);
}

export async function createEmployeePaymentService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    employeeId: string;
    employeeName?: string;
    period?: string;
    frequency?: string;
    periodStart: string;
    periodEnd: string;
    salarioFixo?: number;
    commission?: number;
    totalVales?: number;
    liquido?: number;
  };
}) {
  const [summary, homeInfo] = await Promise.all([
    getEmployeePayrollSummaryService({
      barbershopId: params.barbershopId,
      actorRole: "admin",
      isAdmin: true,
      periodStart: params.data.periodStart,
      periodEnd: params.data.periodEnd,
      employeeId: params.data.employeeId,
    }),
    getHomeInfoByBarbershop(params.barbershopId),
  ]);

  const employeeSummary = summary.items[0];

  if (!employeeSummary) {
    throw badRequest("Funcionario nao encontrado para este periodo.");
  }

  const isBarber = employeeSummary.role === "barber";
  const configuredFrequency = isBarber
    ? (homeInfo?.barber_payment_frequency ?? "monthly")
    : (homeInfo?.employee_payment_frequency ?? "monthly");
  const period = normalizePeriod(configuredFrequency);

  const existingPayment = await findEmployeePaymentByPeriod({
    barbershopId: params.barbershopId,
    employeeId: params.data.employeeId,
    period,
    periodStart: params.data.periodStart,
    periodEnd: params.data.periodEnd,
  });

  if (existingPayment) {
    throw badRequest(
      "Este funcionario ja possui pagamento registrado para este periodo."
    );
  }

  const lastPayment = await findLastEmployeePayment({
    barbershopId: params.barbershopId,
    employeeId: params.data.employeeId,
  });

  if (lastPayment) {
    const lastPaymentDate = new Date(lastPayment.paid_at ?? lastPayment.created_at);

    let nextAllowedDate: Date;

    switch (period) {
      case "semanal":
        nextAllowedDate = addDays(lastPaymentDate, 7);
        break;
      case "quinzenal":
        nextAllowedDate = addDays(lastPaymentDate, 15);
        break;
      case "mensal":
        nextAllowedDate = addMonths(lastPaymentDate, 1);
        break;
      default:
        nextAllowedDate = addDays(lastPaymentDate, 7);
    }

    const hoje = new Date();

    if (hoje < nextAllowedDate) {
      throw badRequest(
        "Ainda nao e possivel realizar um novo pagamento. Aguarde o proximo periodo."
      );
    }
  }

  const created = await createEmployeePayment({
    employeeId: params.data.employeeId,
    employeeName: employeeSummary.employeeName,
    period,
    periodStart: params.data.periodStart,
    periodEnd: params.data.periodEnd,
    baseSalary: employeeSummary.baseSalary,
    commission: employeeSummary.commission,
    totalVales: employeeSummary.totalVales,
    netAmount: employeeSummary.netAmount,
    paidBy: params.actorId,
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}
