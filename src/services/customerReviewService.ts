import { badRequest, forbidden, notFound } from "../errors/index.js";
import prisma from "../database/database.js";

type ActorRole = "admin" | "barber" | "client" | "receptionist" | "super_admin" | string;

type ReviewRow = {
  id: string;
  barbershop_id: string;
  appointment_id: string | null;
  barber_id: string;
  client_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
  client_name: string | null;
  barber_name: string | null;
  appointment_start_at: Date | null;
  services: string | null;
};

type AppointmentRow = {
  id: string;
  barbershop_id: string;
  barber_id: string;
  client_id: string;
  status: string;
  start_at: Date;
};

function canManageReviews(role: ActorRole, isAdmin?: boolean, permissions?: Record<string, unknown> | null) {
  return (
    role === "admin" ||
    role === "receptionist" ||
    role === "super_admin" ||
    isAdmin === true ||
    permissions?.manageAgendamentos === true
  );
}

function mapReview(row: ReviewRow) {
  return {
    id: row.id,
    barbershopId: row.barbershop_id,
    appointmentId: row.appointment_id,
    barberId: row.barber_id,
    clientId: row.client_id,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientName: row.client_name,
    barberName: row.barber_name,
    appointmentStartAt: row.appointment_start_at,
    services: row.services ? row.services.split(", ").filter(Boolean) : [],
  };
}

async function findAppointment(params: { barbershopId: string; appointmentId: string }) {
  const rows = await prisma.$queryRaw<AppointmentRow[]>`
    SELECT id, barbershop_id, barber_id, client_id, status::text, start_at
    FROM appointments
    WHERE id = ${params.appointmentId}::uuid
      AND barbershop_id = ${params.barbershopId}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function createCustomerReviewService(params: {
  barbershopId: string;
  actorId: string;
  actorRole: ActorRole;
  actorIsAdmin?: boolean;
  actorPermissions?: Record<string, unknown> | null;
  data: {
    appointmentId: string;
    rating: number;
    comment?: string | null;
  };
}) {
  const rating = Number(params.data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest("Informe uma nota entre 1 e 5.");
  }

  const appointment = await findAppointment({
    barbershopId: params.barbershopId,
    appointmentId: params.data.appointmentId,
  });

  if (!appointment) {
    throw notFound("Agendamento nao encontrado.");
  }

  const manager = canManageReviews(params.actorRole, params.actorIsAdmin, params.actorPermissions);
  if (!manager && appointment.client_id !== params.actorId) {
    throw forbidden("Voce so pode avaliar seus proprios agendamentos.");
  }

  if (appointment.status !== "completed") {
    throw badRequest("Somente agendamentos finalizados podem ser avaliados.");
  }

  const comment = String(params.data.comment ?? "").trim() || null;

  const rows = await prisma.$queryRaw<ReviewRow[]>`
    INSERT INTO customer_reviews (
      barbershop_id,
      appointment_id,
      barber_id,
      client_id,
      rating,
      comment
    )
    VALUES (
      ${params.barbershopId}::uuid,
      ${appointment.id}::uuid,
      ${appointment.barber_id}::uuid,
      ${appointment.client_id}::uuid,
      ${rating},
      ${comment}
    )
    ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
    DO UPDATE SET
      rating = EXCLUDED.rating,
      comment = EXCLUDED.comment,
      updated_at = now()
    RETURNING
      customer_reviews.*,
      (SELECT name FROM users WHERE id = customer_reviews.client_id) AS client_name,
      (SELECT display_name FROM barbers WHERE id = customer_reviews.barber_id) AS barber_name,
      (SELECT start_at FROM appointments WHERE id = customer_reviews.appointment_id) AS appointment_start_at,
      (
        SELECT string_agg(service_name, ', ' ORDER BY service_name)
        FROM appointment_services
        WHERE appointment_id = customer_reviews.appointment_id
      ) AS services
  `;

  return mapReview(rows[0]);
}

export async function listCustomerReviewsService(params: {
  barbershopId: string;
  actorId: string;
  actorRole: ActorRole;
  actorIsAdmin?: boolean;
  actorPermissions?: Record<string, unknown> | null;
  limit?: number;
}) {
  const limit = Math.min(Math.max(Number(params.limit ?? 200), 1), 500);
  const manager = canManageReviews(params.actorRole, params.actorIsAdmin, params.actorPermissions);

  const rows = manager
    ? await prisma.$queryRaw<ReviewRow[]>`
        SELECT
          cr.*,
          u.name AS client_name,
          b.display_name AS barber_name,
          a.start_at AS appointment_start_at,
          string_agg(aps.service_name, ', ' ORDER BY aps.service_name) AS services
        FROM customer_reviews cr
        LEFT JOIN users u ON u.id = cr.client_id
        LEFT JOIN barbers b ON b.id = cr.barber_id
        LEFT JOIN appointments a ON a.id = cr.appointment_id
        LEFT JOIN appointment_services aps ON aps.appointment_id = cr.appointment_id
        WHERE cr.barbershop_id = ${params.barbershopId}::uuid
        GROUP BY cr.id, u.name, b.display_name, a.start_at
        ORDER BY cr.created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<ReviewRow[]>`
        SELECT
          cr.*,
          u.name AS client_name,
          b.display_name AS barber_name,
          a.start_at AS appointment_start_at,
          string_agg(aps.service_name, ', ' ORDER BY aps.service_name) AS services
        FROM customer_reviews cr
        LEFT JOIN users u ON u.id = cr.client_id
        LEFT JOIN barbers b ON b.id = cr.barber_id
        LEFT JOIN appointments a ON a.id = cr.appointment_id
        LEFT JOIN appointment_services aps ON aps.appointment_id = cr.appointment_id
        WHERE cr.barbershop_id = ${params.barbershopId}::uuid
          AND cr.client_id = ${params.actorId}::uuid
        GROUP BY cr.id, u.name, b.display_name, a.start_at
        ORDER BY cr.created_at DESC
        LIMIT ${limit}
      `;

  return {
    items: rows.map(mapReview),
    total: rows.length,
  };
}
