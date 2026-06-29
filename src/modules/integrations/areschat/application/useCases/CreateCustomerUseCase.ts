import bcrypt from "bcrypt";
import crypto from "crypto";
import { conflict } from "../../../../../errors/index.js";
import { mapCustomerToIntegrationDto } from "../mappers/IntegrationCustomerMapper.js";
import {
  createCustomerInBarbershop,
  findUserByCpf,
  findUserByCpfInBarbershop,
  findUserByEmail,
  findUserByEmailInBarbershop,
  findUserByPhone,
  findUserByPhoneInBarbershop,
  linkUserToBarbershop
} from "../../infra/repositories/IntegrationCustomerRepository.js";

export interface CreateCustomerInput {
  tenantId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
}

const normalizePhone = (value?: string | null) => {
  const phone = String(value || "").replace(/\D/g, "");
  return phone.length ? phone : null;
};

const normalizeEmail = (value?: string | null) => {
  const email = String(value || "").trim().toLowerCase();
  return email.length ? email : null;
};

const normalizeDocument = (value?: string | null) => {
  const document = String(value || "").replace(/\D/g, "");
  return document.length ? document : null;
};

function bcryptRounds() {
  return Number(process.env.BCRYPT_SALT_ROUNDS || 10);
}

function ensureSingleCustomer(matches: Array<{ id: string }>) {
  const uniqueIds = Array.from(new Set(matches.map(item => item.id)));

  if (uniqueIds.length > 1) {
    throw conflict(
      "Os identificadores informados pertencem a clientes diferentes"
    );
  }
}

async function resolveCustomerInTenant(input: {
  tenantId: string;
  phone: string | null;
  email: string | null;
  document: string | null;
}) {
  const matches = await Promise.all([
    input.phone
      ? findUserByPhoneInBarbershop(input.tenantId, input.phone)
      : Promise.resolve(null),
    input.email
      ? findUserByEmailInBarbershop(input.tenantId, input.email)
      : Promise.resolve(null),
    input.document
      ? findUserByCpfInBarbershop(input.tenantId, input.document)
      : Promise.resolve(null)
  ]);

  const validMatches = matches.filter(Boolean) as Array<{ id: string }>;
  ensureSingleCustomer(validMatches);

  return matches.find(Boolean) || null;
}

async function resolveCustomerGlobally(input: {
  phone: string | null;
  email: string | null;
  document: string | null;
}) {
  const matches = await Promise.all([
    input.phone ? findUserByPhone(input.phone) : Promise.resolve(null),
    input.email ? findUserByEmail(input.email) : Promise.resolve(null),
    input.document ? findUserByCpf(input.document) : Promise.resolve(null)
  ]);

  const validMatches = matches.filter(Boolean) as Array<{ id: string }>;
  ensureSingleCustomer(validMatches);

  return matches.find(Boolean) || null;
}

export async function CreateCustomerUseCase(input: CreateCustomerInput) {
  const normalizedName = input.name.trim();
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const document = normalizeDocument(input.document);

  const customerInTenant = await resolveCustomerInTenant({
    tenantId: input.tenantId,
    phone,
    email,
    document
  });

  if (customerInTenant) {
    return mapCustomerToIntegrationDto(customerInTenant, {
      created: false
    });
  }

  const globalCustomer = await resolveCustomerGlobally({
    phone,
    email,
    document
  });

  if (globalCustomer) {
    const linkedCustomer = await linkUserToBarbershop(
      input.tenantId,
      globalCustomer.id
    );

    return mapCustomerToIntegrationDto(linkedCustomer, {
      created: false
    });
  }

  const passwordHash = await bcrypt.hash(
    crypto.randomUUID(),
    bcryptRounds()
  );

  const createdCustomer = await createCustomerInBarbershop({
    tenantId: input.tenantId,
    name: normalizedName,
    phone,
    email,
    cpf: document,
    passwordHash
  });

  return mapCustomerToIntegrationDto(createdCustomer, {
    created: true
  });
}
