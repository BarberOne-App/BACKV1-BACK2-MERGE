import nodemailer from "nodemailer";
import { MailtrapClient } from "mailtrap";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// async function buildTransporter() {
//   const host = process.env.EMAIL_HOST;
//   const user = process.env.EMAIL_USER;
//   const pass = process.env.EMAIL_PASSWORD;

//   if (!host || !user || !pass) {
//     console.warn("[email] SMTP não configurado. Usando modo de teste (Ethereal). Configure EMAIL_HOST, EMAIL_USER e EMAIL_PASSWORD para envio real.");
//     const testAccount = await nodemailer.createTestAccount();
//     return nodemailer.createTransport({
//       host: "smtp.ethereal.email",
//       port: 587,
//       secure: false,
//       auth: {
//         user: testAccount.user,
//         pass: testAccount.pass,
//       },
//     });
//   }

//   return nodemailer.createTransport({
//     host,
//     port: toNumber(process.env.EMAIL_PORT, 587),
//     secure: String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true",
//     auth: {
//       user,
//       pass,
//     },
//   });
// }

function formatDateTime(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);

  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    date: dateFormatter.format(value),
    time: timeFormatter.format(value),
  };
}

export async function sendAppointmentConfirmedEmail(params: {
  to: string;
  clientName?: string | null;
  dependentName?: string | null;
  barberName?: string | null;
  startAt: Date | string;
  serviceNames: string[];
}) {

  const TOKEN = process.env.MAILTRAP_TOKEN;
  const { date, time } = formatDateTime(params.startAt);
  const displayName = params.dependentName || params.clientName || "cliente";
  const services = params.serviceNames.length ? params.serviceNames.join(", ") : "Serviço";
  const barber = params.barberName || "seu barbeiro";
  const to = params.to;

  if (!TOKEN) {
    throw new Error("[email][mailtrap] MAILTRAP_TOKEN não definido");
  }

  const client = new MailtrapClient({
    token: TOKEN,
  });

  const sender = {
    email: "admin@adtechsolutions-softwares.com",
    name: "Mailtrap Test",
  };
  const recipients = [
    {
      email: to,
    }
  ];

  const text = [
    `Olá, ${displayName}!`,
    "",
    "Seu agendamento foi confirmado com sucesso.",
    `Data: ${date}`,
    `Horário: ${time}`,
    `Barbeiro: ${barber}`,
    `Serviços: ${services}`,
    "",
    "Se precisar remarcar, entre em contato com a barbearia.",
  ].join("\n");

  client
    .send({
      from: sender,
      to: recipients,
      subject: "Agendamento Confirmado - Teste de Integração",
      text: text,
      category: "Agendamento Confirmado",
    })
    .then(console.log, console.error);
}
