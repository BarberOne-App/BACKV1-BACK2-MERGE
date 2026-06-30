import prisma from "../database/database.js";
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
    revokedAt: credential.revoked_at,
    createdAt: credential.created_at,
    updatedAt: credential.updated_at,
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
