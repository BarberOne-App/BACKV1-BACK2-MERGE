import prisma from "../database/database.js";
import crypto from "crypto";
import { forbidden, notFound } from "../errors/index.js";
import {
  createIntegrationCredential,
  findLatestActiveIntegrationCredentialByBarbershop,
  revokeActiveIntegrationCredentialsByBarbershop,
} from "../modules/integrations/areschat/infra/repositories/IntegrationCredentialRepository.js";

type RequestUser = {
  barbershopId: string;
  role: string;
  isAdmin: boolean;
};

const isSuperAdmin = (role: unknown) => String(role || "") === "super_admin";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function getOutboundTokenSecret() {
  return String(
    process.env.ARESCHAT_OUTBOUND_TOKEN_SECRET ||
      process.env.INTEGRATION_TOKEN_PEPPER ||
      process.env.JWT_SECRET ||
      ""
  ).trim();
}

function encryptOutboundToken(token: string) {
  const secret = getOutboundTokenSecret();
  if (!secret) throw forbidden("Chave de criptografia do token AresChat nao configurada");

  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function maskOutboundToken(token: string) {
  const normalized = String(token || "").trim();
  if (normalized.length <= 12) return "********";
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function resolveIntegrationBaseUrl() {
  const explicit = String(
    process.env.ARESCHAT_INTEGRATION_BASE_URL ||
      process.env.BARBERONE_ARESCHAT_INTEGRATION_BASE_URL ||
      ""
  ).trim();

  if (explicit) return trimTrailingSlash(explicit);

  const publicApiUrl = String(
    process.env.PUBLIC_API_URL ||
      process.env.API_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      ""
  ).trim();

  if (publicApiUrl) {
    const base = trimTrailingSlash(publicApiUrl);
    return base.endsWith("/api/integrations/areschat/v1")
      ? base
      : `${base}/api/integrations/areschat/v1`;
  }

  return `http://localhost:${process.env.PORT || 4000}/api/integrations/areschat/v1`;
}

function resolveDomain(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return "";
  }
}

async function resolveTargetBarbershopId(user: RequestUser, requestedBarbershopId?: string | null) {
  if (isSuperAdmin(user.role)) {
    const id = String(requestedBarbershopId || "").trim();
    if (!id) throw forbidden("Informe a barbearia para gerar os dados AresChat");
    return id;
  }

  if (!user.isAdmin) {
    throw forbidden("Apenas admin pode gerar dados de integracao");
  }

  return user.barbershopId;
}

async function getBarbershopOrThrow(barbershopId: string) {
  const barbershop = await prisma.barbershops.findUnique({
    where: { id: barbershopId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      email: true,
      phone: true,
    },
  });

  if (!barbershop) {
    throw notFound("Barbearia nao encontrada");
  }

  return barbershop;
}

function buildAresChatFields(params: {
  barbershop: Awaited<ReturnType<typeof getBarbershopOrThrow>>;
  baseUrl: string;
  token?: string;
}) {
  const { barbershop, baseUrl, token } = params;

  return {
    empresa: "Selecionar no painel do AresChat a empresa que usara esta integracao",
    name: `BarberOne - ${barbershop.name}`,
    partnerName: "BarberOne",
    domain: resolveDomain(baseUrl),
    provider: "barberone",
    baseUrl,
    authType: "bearer",
    token: token || null,
    defaultHeaders: {
      Accept: "application/json",
    },
    timeoutMs: 10000,
    isActive: true,
  };
}

function mapCredential(credential: any) {
  if (!credential) return null;

  return {
    id: credential.id,
    name: credential.name,
    tokenPrefix: credential.token_prefix,
    active: credential.active,
    lastUsedAt: credential.last_used_at,
    outbound: {
      configured: !!credential.send_message_url && !!credential.whatsapp_token_encrypted,
      sendMessageUrl: credential.send_message_url || null,
      whatsappTokenPrefix: credential.whatsapp_token_prefix || null,
    },
    revokedAt: credential.revoked_at,
    createdAt: credential.created_at,
    updatedAt: credential.updated_at,
  };
}

export async function updateAresChatOutboundConfigService(params: {
  user: RequestUser;
  barbershopId?: string | null;
  sendMessageUrl: string;
  whatsappToken: string;
}) {
  const barbershopId = await resolveTargetBarbershopId(params.user, params.barbershopId);
  await getBarbershopOrThrow(barbershopId);

  const sendMessageUrl = trimTrailingSlash(String(params.sendMessageUrl || "").trim());
  const whatsappToken = String(params.whatsappToken || "").trim();

  if (!sendMessageUrl) throw forbidden("URL de envio AresChat nao informada");
  if (!whatsappToken) throw forbidden("Token da conexao WhatsApp do AresChat nao informado");

  let credential = await findLatestActiveIntegrationCredentialByBarbershop(barbershopId);
  if (!credential) {
    const created = await createIntegrationCredential({
      barbershopId,
      name: "AresChat",
    });
    credential = created.credential;
  }

  const updated = await prisma.integration_credentials.update({
    where: { id: credential.id },
    data: {
      send_message_url: sendMessageUrl,
      whatsapp_token_encrypted: encryptOutboundToken(whatsappToken),
      whatsapp_token_prefix: maskOutboundToken(whatsappToken),
      updated_at: new Date(),
    },
  });

  return {
    credential: mapCredential(updated),
    message: "Configuracao de envio AresChat atualizada com sucesso",
  };
}

export async function getAresChatSetupDataService(params: {
  user: RequestUser;
  barbershopId?: string | null;
}) {
  const barbershopId = await resolveTargetBarbershopId(params.user, params.barbershopId);
  const barbershop = await getBarbershopOrThrow(barbershopId);
  const baseUrl = resolveIntegrationBaseUrl();
  const credential = await findLatestActiveIntegrationCredentialByBarbershop(barbershop.id);

  return {
    tokenAvailable: false,
    tokenMessage:
      "Por seguranca, o token completo so e exibido ao gerar uma nova credencial.",
    barbershop,
    credential: mapCredential(credential),
    areschatIntegrationFields: buildAresChatFields({ barbershop, baseUrl }),
    testRequests: {
      health: {
        method: "GET",
        url: `${baseUrl}/health`,
        headers: {
          Accept: "application/json",
        },
      },
    },
  };
}

export async function generateAresChatSetupDataService(params: {
  user: RequestUser;
  barbershopId?: string | null;
  name?: string | null;
}) {
  const barbershopId = await resolveTargetBarbershopId(params.user, params.barbershopId);
  const barbershop = await getBarbershopOrThrow(barbershopId);
  const baseUrl = resolveIntegrationBaseUrl();

  const { credential, token } = await prisma.$transaction(async tx => {
    await revokeActiveIntegrationCredentialsByBarbershop({
      barbershopId: barbershop.id,
      tx,
    });

    return createIntegrationCredential({
      barbershopId: barbershop.id,
      name: params.name || `AresChat - ${barbershop.name}`,
      tx,
    });
  });

  return {
    tokenAvailable: true,
    tokenMessage:
      "Guarde este token agora. Ele nao sera exibido novamente depois desta resposta.",
    barbershop,
    credential: {
      ...mapCredential(credential),
      token,
      authorizationHeader: `Bearer ${token}`,
    },
    areschatIntegrationFields: buildAresChatFields({
      barbershop,
      baseUrl,
      token,
    }),
    testRequests: {
      health: {
        method: "GET",
        url: `${baseUrl}/health`,
        headers: {
          Accept: "application/json",
        },
      },
      services: {
        method: "GET",
        url: `${baseUrl}/services`,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    },
  };
}
