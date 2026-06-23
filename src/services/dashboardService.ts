import prisma from "../database/database.js";

function toNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

const WEEKDAY_SHORT: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sab",
};

export async function getDashboardStats(barbershopId: string) {
  const now = new Date();

  // Hoje (UTC)
  const todayStr = now.toISOString().split("T")[0];
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

  // Mês corrente (UTC)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );

  // Últimos 7 dias
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const [
    appointmentsToday,
    appointmentsThisMonth,
    appointmentsCancelledThisMonth,
    totalClients,
    newClientsThisMonth,
    activeSubscriptionRows,
    revenueThisMonthRows,
    revenueByDayRows,
    recentAppointments,
    barbers,
    barberAppointmentCounts,
    // ] = await Promise.all([
    //   // Agendamentos hoje (excluindo cancelados e no-show)
    //   prisma.appointments.count({
    //     where: {
    //       barbershop_id: barbershopId,
    //       start_at: { gte: todayStart, lte: todayEnd },
    //       status: { in: ["scheduled", "confirmed", "completed"] as any },
    //     },
    //   }),
  ] = await prisma.$transaction([
    // Agendamentos hoje (excluindo cancelados e no-show)
    prisma.appointments.count({
      where: {
        barbershop_id: barbershopId,
        start_at: { gte: todayStart, lte: todayEnd },
        status: { in: ["scheduled", "confirmed", "completed"] as any },
      },
    }),

    // Agendamentos este mês (todos)
    prisma.appointments.count({
      where: {
        barbershop_id: barbershopId,
        start_at: { gte: monthStart, lte: monthEnd },
      },
    }),

    // Cancelados / no-show este mês
    prisma.appointments.count({
      where: {
        barbershop_id: barbershopId,
        start_at: { gte: monthStart, lte: monthEnd },
        status: { in: ["cancelled", "no_show"] as any },
      },
    }),

    // Total de clientes da barbearia
    prisma.users.count({
      where: {
        current_barbershop_id: barbershopId,
        role: "client" as any,
      },
    }),

    // Novos clientes este mês
    prisma.users.count({
      where: {
        current_barbershop_id: barbershopId,
        role: "client" as any,
        created_at: { gte: monthStart },
      },
    }),

    // Assinaturas ativas (para contagem e receita recorrente)
    prisma.subscriptions.findMany({
      where: { barbershop_id: barbershopId, status: "active" as any },
      select: { amount: true },
    }),

    // Receita do mês (pagamentos confirmados)
    prisma.payment_transactions.findMany({
      where: {
        barbershop_id: barbershopId,
        status: { in: ["paid", "approved", "covered"] as any },
        paid_at: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true },
    }),

    // Pagamentos dos últimos 7 dias para o gráfico
    prisma.payment_transactions.findMany({
      where: {
        barbershop_id: barbershopId,
        status: { in: ["paid", "approved", "covered"] as any },
        paid_at: { gte: sevenDaysAgo, lte: now },
      },
      select: { paid_at: true, amount: true },
    }),

    // Agendamentos recentes
    prisma.appointments.findMany({
      where: { barbershop_id: barbershopId },
      orderBy: { start_at: "desc" },
      take: 8,
      select: {
        id: true,
        start_at: true,
        status: true,
        users: { select: { id: true, name: true } },
        dependents: { select: { id: true, name: true } },
        barbers: { select: { id: true, display_name: true, photo_url: true } },
        appointment_services: {
          select: { service_name: true },
          orderBy: { id: "asc" },
          take: 3,
        },
      },
    }),

    // Barbeiros da barbearia
    prisma.barbers.findMany({
      where: { barbershop_id: barbershopId },
      select: { id: true, display_name: true, photo_url: true, specialty: true },
      orderBy: { display_name: "asc" },
    }),

    // Contagem de agendamentos concluídos por barbeiro este mês
    prisma.appointments.groupBy({
      by: ["barber_id"],
      where: {
        barbershop_id: barbershopId,
        start_at: { gte: monthStart, lte: monthEnd },
        status: { in: ["completed", "confirmed"] as any },
      },
      _count: { id: true },
      orderBy: {
        barber_id: "asc",
      }
    }),
  ]);

  /* ── Cálculos ── */

  const activeSubscriptions = activeSubscriptionRows.length;
  const monthlyRecurringRevenue = activeSubscriptionRows.reduce(
    (sum, s) => sum + toNumber(s.amount),
    0
  );

  const revenueThisMonth = revenueThisMonthRows.reduce(
    (sum, p) => sum + toNumber(p.amount),
    0
  );

  // Gráfico: mapa com os últimos 7 dias inicializados em zero
  const revenueMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    revenueMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const row of revenueByDayRows) {
    if (!row.paid_at) continue;
    const key = new Date(row.paid_at).toISOString().split("T")[0];
    if (revenueMap.has(key)) {
      revenueMap.set(key, (revenueMap.get(key) ?? 0) + toNumber(row.amount));
    }
  }
  const revenueByDay = Array.from(revenueMap.entries()).map(([date, total]) => ({
    date,
    day: WEEKDAY_SHORT[new Date(date + "T12:00:00Z").getUTCDay()] ?? date,
    total,
  }));

  const getCountId = (
    count: (typeof barberAppointmentCounts)[number]["_count"]
  ): number => {
    if (!count || count === true) return 0;
    return count.id ?? 0;
  };

  // Mapa de contagem de agendamentos por barbeiro
  const barberCountMap = new Map<string, number>();
  for (const row of barberAppointmentCounts) {
    if (row.barber_id) barberCountMap.set(row.barber_id, getCountId(row._count));
  }

  const staff = barbers.map((b) => ({
    id: b.id,
    name: b.display_name,
    photo: b.photo_url ?? null,
    specialty: b.specialty ?? null,
    appointmentsThisMonth: barberCountMap.get(b.id) ?? 0,
  }));

  const recentAppointmentsList = recentAppointments.map((a) => {
    const services = a.appointment_services.map((s) => s.service_name);
    return {
      id: a.id,
      startAt: a.start_at,
      status: a.status,
      clientName: a.users?.name ?? a.dependents?.name ?? "Cliente",
      barberName: a.barbers?.display_name ?? "—",
      services,
      serviceLabel: services.length > 0 ? services[0] : "—",
      serviceCount: services.length,
    };
  });

  return {
    appointmentsToday,
    appointmentsThisMonth,
    appointmentsCancelledThisMonth,
    totalClients,
    newClientsThisMonth,
    activeSubscriptions,
    monthlyRecurringRevenue,
    revenueThisMonth,
    revenueByDay,
    recentAppointments: recentAppointmentsList,
    staff,
  };
}
