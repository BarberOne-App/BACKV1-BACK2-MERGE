import prisma from "../../../../../database/database.js";
import { notFound } from "../../../../../errors/index.js";
import {
  createIntegrationCredential,
  listIntegrationCredentialsByBarbershop,
  revokeIntegrationCredential
} from "../../infra/repositories/IntegrationCredentialRepository.js";

const mapCredential = (credential: any) => ({
  id: credential.id,
  provider: credential.provider,
  barbershopId: credential.barbershop_id,
  name: credential.name,
  tokenPrefix: credential.token_prefix,
  active: credential.active,
  lastUsedAt: credential.last_used_at,
  revokedAt: credential.revoked_at,
  createdAt: credential.created_at,
  updatedAt: credential.updated_at
});

async function assertBarbershopExists(barbershopId: string) {
  const barbershop = await prisma.barbershops.findUnique({
    where: { id: barbershopId },
    select: { id: true }
  });

  if (!barbershop) {
    throw notFound("Barbearia nao encontrada");
  }
}

export async function ListIntegrationCredentialsUseCase(barbershopId: string) {
  await assertBarbershopExists(barbershopId);
  const credentials = await listIntegrationCredentialsByBarbershop(barbershopId);
  return credentials.map(mapCredential);
}

export async function CreateIntegrationCredentialUseCase(input: {
  barbershopId: string;
  name?: string | null;
}) {
  await assertBarbershopExists(input.barbershopId);
  const { credential, token } = await createIntegrationCredential(input);

  return {
    ...mapCredential(credential),
    token
  };
}

export async function RevokeIntegrationCredentialUseCase(input: {
  credentialId: string;
  barbershopId?: string;
}) {
  const result = await revokeIntegrationCredential(input);

  if (result.count === 0) {
    throw notFound("Credencial de integracao nao encontrada");
  }

  return {
    revoked: true
  };
}
