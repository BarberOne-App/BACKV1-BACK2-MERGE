import crypto from "crypto";
import prisma from "../../../../../database/database.js";

const PROVIDER = "areschat";
const TOKEN_PREFIX = "areschat";

const getTokenPepper = () =>
  String(process.env.INTEGRATION_TOKEN_PEPPER || "").trim();

export const hashIntegrationToken = (token: string) => {
  const pepper = getTokenPepper();
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${token}`)
    .digest("hex");
};

export const maskTokenPrefix = (token: string) => {
  const normalized = String(token || "").trim();
  return normalized.length <= 14
    ? normalized
    : `${normalized.slice(0, 10)}...${normalized.slice(-4)}`;
};

export const generateIntegrationToken = () => {
  const envLabel =
    String(process.env.NODE_ENV || "dev").toLowerCase() === "production"
      ? "prod"
      : "hml";
  return `${TOKEN_PREFIX}_${envLabel}_${crypto.randomBytes(32).toString("hex")}`;
};

export async function findActiveIntegrationCredentialByToken(token: string) {
  const tokenHash = hashIntegrationToken(token);

  return prisma.integration_credentials.findFirst({
    where: {
      provider: PROVIDER,
      token_hash: tokenHash,
      active: true,
      revoked_at: null
    },
    include: {
      barbershops: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true
        }
      }
    }
  });
}

export async function touchIntegrationCredentialLastUsed(id: string) {
  return prisma.integration_credentials.update({
    where: { id },
    data: {
      last_used_at: new Date(),
      updated_at: new Date()
    }
  });
}

export async function listIntegrationCredentialsByBarbershop(
  barbershopId: string
) {
  return prisma.integration_credentials.findMany({
    where: {
      provider: PROVIDER,
      barbershop_id: barbershopId
    },
    orderBy: {
      created_at: "desc"
    }
  });
}

export async function createIntegrationCredential(params: {
  barbershopId: string;
  name?: string | null;
}) {
  const token = generateIntegrationToken();

  const credential = await prisma.integration_credentials.create({
    data: {
      provider: PROVIDER,
      barbershop_id: params.barbershopId,
      name: params.name?.trim() || "AresChat",
      token_hash: hashIntegrationToken(token),
      token_prefix: maskTokenPrefix(token),
      active: true
    }
  });

  return {
    credential,
    token
  };
}

export async function revokeIntegrationCredential(params: {
  credentialId: string;
  barbershopId?: string;
}) {
  return prisma.integration_credentials.updateMany({
    where: {
      id: params.credentialId,
      ...(params.barbershopId ? { barbershop_id: params.barbershopId } : {})
    },
    data: {
      active: false,
      revoked_at: new Date(),
      updated_at: new Date()
    }
  });
}
