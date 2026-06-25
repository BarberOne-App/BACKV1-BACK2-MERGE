import dns from "dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

dns.setDefaultResultOrder("ipv4first");

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const host = process.env.EMAIL_HOST;
  const portStr = process.env.EMAIL_PORT;
  const secureStr = process.env.EMAIL_SECURE;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  console.log("[email] Inicializando transporte SMTP...");
  console.log(`[email] Host: ${host || "não definido"}`);
  console.log(`[email] Porta: ${portStr || "não definido"}`);
  console.log(`[email] Secure (SSL/TLS): ${secureStr || "não definido"}`);
  console.log(`[email] Usuário: ${user || "não definido"}`);
  console.log(`[email] Senha: ${pass ? "**** (definida)" : "não definida"}`);

  if (!host) {
    throw new Error("[email] Configuração de e-mail SMTP inválida: EMAIL_HOST não definido.");
  }
  if (!user) {
    throw new Error("[email] Configuração de e-mail SMTP inválida: EMAIL_USER não definido.");
  }
  if (!pass) {
    throw new Error("[email] Configuração de e-mail SMTP inválida: EMAIL_PASSWORD não definido.");
  }

  const port = toNumber(portStr, 587);
  const secure = String(secureStr || "false").toLowerCase() === "true";

  console.log(`[email] Host SMTP utilizado: ${host}`);
  console.log(`[email] Porta utilizada: ${port}`);
  console.log(`[email] Secure: ${secure ? "habilitado" : "desabilitado"}`);
  console.log(`[email] Usuario SMTP utilizado: ${user}`);
  console.log("[email] Conexao SMTP restrita a IPv4 (family: 4)");

  const transportOptions: SMTPTransport.Options & { family: 4 } = {
    host,
    port,
    secure,
    family: 4,
    requireTLS: port === 587,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000, // Timeout de 10 segundos
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };

  transporter = nodemailer.createTransport(transportOptions);

  // Verificação assíncrona não-bloqueante para não impedir a inicialização do backend
  transporter.verify((error) => {
    if (error) {
      logSmtpError(error, "verificação inicial do transporte SMTP");
    } else {
      console.log("[email] Servidor pronto para enviar e-mails via SMTP!");
    }
  });

  return transporter;
}

function logSmtpError(error: any, recipient: string) {
  console.error(`[email] Falha no envio de e-mail para ${recipient}:`);
  console.error(`[email] Código do erro SMTP: ${error?.code ?? "não informado"}`);
  console.error(`[email] Comando falho: ${error?.command ?? "não informado"}`);
  if (error.response) {
    console.error(`[email] Resposta do servidor SMTP: ${error.response}`);
  }
  console.error(`[email] Mensagem de erro detalhada: ${error?.message ?? String(error)}`);
  console.error(`[email] Stack trace completa:\n${error?.stack ?? "não disponível"}`);

  // Dicas baseadas no código do erro
  if (error.code === "EAUTH") {
    console.error("[email] DICA: Falha de autenticação SMTP. Verifique se EMAIL_USER e EMAIL_PASSWORD estão corretos no servidor/HostGator.");
  } else if (error.code === "ESOCKET" || error.code === "ECONNREFUSED") {
    console.error("[email] DICA: Não foi possível conectar ao servidor SMTP. Verifique EMAIL_HOST e EMAIL_PORT, ou se o firewall bloqueia a porta.");
  } else if (error.code === "ETIMEOUT") {
    console.error("[email] DICA: Tempo limite de conexão com o servidor SMTP expirou.");
  }
}

function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error("[email] Configuração de e-mail SMTP inválida: EMAIL_FROM não definido.");
  }

  return from;
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  barbershopName?: string | null;
}) {
  const from = getEmailFrom();
  const context = params.barbershopName
    ? ` Sua conta está vinculada à barbearia ${params.barbershopName}.`
    : "";
  const text = [
    `Olá, ${params.name}!`,
    "",
    `Seja bem-vindo ao BarberOne!${context}`,
    "Sua conta foi criada com sucesso e já está pronta para uso.",
    "",
    "Acesse a plataforma para gerenciar seus agendamentos e serviços.",
  ].join("\n");

  try {
    const info = await getTransporter().sendMail({
      from,
      to: params.to,
      subject: "Bem-vindo ao BarberOne!",
      text,
    });
    console.log(`[email] E-mail de boas-vindas enviado com sucesso! MessageId: ${info.messageId}`);
  } catch (error: any) {
    logSmtpError(error, params.to);
    throw error;
  }
}

type AppointmentEmailItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export async function sendAppointmentReceiptEmail(params: {
  to: string;
  appointmentId: string;
  clientName: string;
  dependentName?: string | null;
  barbershopName: string;
  barberName?: string | null;
  startAt: Date | string;
  services: AppointmentEmailItem[];
  products?: AppointmentEmailItem[];
  totalAmount: number;
}) {
  const from = getEmailFrom();
  const { date, time } = formatDateTime(params.startAt);
  const customer = params.dependentName
    ? `${params.dependentName} (responsável: ${params.clientName})`
    : params.clientName;
  const serviceLines = params.services.map(
    (item) => `- ${item.name} x${item.quantity}: ${formatCurrency(item.unitPrice * item.quantity)}`,
  );
  const productLines = (params.products ?? []).map(
    (item) => `- ${item.name} x${item.quantity}: ${formatCurrency(item.unitPrice * item.quantity)}`,
  );
  const text = [
    `Olá, ${params.clientName}!`,
    "",
    "Seu agendamento foi realizado com sucesso.",
    `Comprovante: #${params.appointmentId}`,
    `Barbearia: ${params.barbershopName}`,
    `Cliente: ${customer}`,
    `Data: ${date}`,
    `Horário: ${time}`,
    `Barbeiro: ${params.barberName || "A definir"}`,
    "",
    "Serviços:",
    ...serviceLines,
    ...(productLines.length ? ["", "Produtos:", ...productLines] : []),
    "",
    `Total: ${formatCurrency(params.totalAmount)}`,
    "Status: Agendado",
    "",
    "Guarde este e-mail como comprovante do agendamento.",
  ].join("\n");

  try {
    const info = await getTransporter().sendMail({
      from,
      to: params.to,
      subject: `Comprovante de agendamento - ${params.barbershopName}`,
      text,
    });
    console.log(`[email] Comprovante de agendamento enviado com sucesso! MessageId: ${info.messageId}`);
  } catch (error: any) {
    logSmtpError(error, params.to);
    throw error;
  }
}

export async function sendNewAppointmentNotificationEmail(params: {
  to: string;
  appointmentId: string;
  barbershopName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  dependentName?: string | null;
  barberName?: string | null;
  startAt: Date | string;
  serviceNames: string[];
  totalAmount: number;
}) {
  const from = getEmailFrom();
  const { date, time } = formatDateTime(params.startAt);
  const text = [
    `Novo agendamento recebido na ${params.barbershopName}.`,
    "",
    `Agendamento: #${params.appointmentId}`,
    `Cliente: ${params.clientName}`,
    ...(params.dependentName ? [`Dependente: ${params.dependentName}`] : []),
    ...(params.clientEmail ? [`E-mail: ${params.clientEmail}`] : []),
    ...(params.clientPhone ? [`Telefone: ${params.clientPhone}`] : []),
    `Data: ${date}`,
    `Horário: ${time}`,
    `Barbeiro: ${params.barberName || "A definir"}`,
    `Serviços: ${params.serviceNames.join(", ") || "Não informado"}`,
    `Total: ${formatCurrency(params.totalAmount)}`,
  ].join("\n");

  try {
    const info = await getTransporter().sendMail({
      from,
      to: params.to,
      subject: `Novo agendamento - ${params.clientName} em ${date} às ${time}`,
      text,
    });
    console.log(`[email] Notificação para a barbearia enviada com sucesso! MessageId: ${info.messageId}`);
  } catch (error: any) {
    logSmtpError(error, params.to);
    throw error;
  }
}

export async function sendAppointmentConfirmedEmail(params: {
  to: string;
  clientName?: string | null;
  dependentName?: string | null;
  barberName?: string | null;
  startAt: Date | string;
  serviceNames: string[];
}) {
  const { date, time } = formatDateTime(params.startAt);
  const displayName = params.dependentName || params.clientName || "cliente";
  const services = params.serviceNames.length ? params.serviceNames.join(", ") : "Serviço";
  const barber = params.barberName || "seu barbeiro";
  const to = params.to;

  const from = getEmailFrom();

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

  try {
    const mailTransporter = getTransporter();
    console.log(`[email] Enviando e-mail de agendamento confirmado para: ${to}`);
    const info = await mailTransporter.sendMail({
      from,
      to,
      subject: "Agendamento Confirmado - Teste de Integração",
      text,
    });
    console.log(`[email] E-mail de agendamento enviado com sucesso! MessageId: ${info.messageId}`);
  } catch (error: any) {
    logSmtpError(error, to);
  }
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetLink: string;
}) {
  const from = getEmailFrom();

  const text = [
    `Olá, ${params.name}!`,
    "",
    "Você solicitou a recuperação de sua senha no BarberOne.",
    "Para cadastrar uma nova senha, clique no link abaixo (válido por 1 hora):",
    "",
    params.resetLink,
    "",
    "Se você não solicitou essa alteração, ignore este e-mail.",
  ].join("\n");

  try {
    const mailTransporter = getTransporter();
    console.log(`[email] Iniciando envio de e-mail de recuperação de senha para: ${params.to}`);
    const info = await mailTransporter.sendMail({
      from,
      to: params.to,
      subject: "Recuperação de Senha - BarberOne",
      text,
    });
    console.log(`[email] E-mail de recuperação de senha enviado com sucesso! MessageId: ${info.messageId}`);
  } catch (error: any) {
    logSmtpError(error, params.to);
    throw error;
  }
}
