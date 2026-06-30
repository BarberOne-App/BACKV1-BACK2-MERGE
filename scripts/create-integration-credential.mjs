import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROVIDER = "areschat";

const [, , barbershopId, ...nameParts] = process.argv;
const name = nameParts.join(" ").trim() || "AresChat";

const usage = () => {
  console.error(
    "Uso: node scripts/create-integration-credential.mjs <barbershopId> [nome]"
  );
};

const getTokenPepper = () =>
  String(process.env.INTEGRATION_TOKEN_PEPPER || "").trim();

const hashToken = token =>
  crypto
    .createHash("sha256")
    .update(`${getTokenPepper()}:${token}`)
    .digest("hex");

const maskTokenPrefix = token =>
  token.length <= 14 ? token : `${token.slice(0, 10)}...${token.slice(-4)}`;

const generateToken = () => {
  const envLabel =
    String(process.env.NODE_ENV || "dev").toLowerCase() === "production"
      ? "prod"
      : "hml";

  return `areschat_${envLabel}_${crypto.randomBytes(32).toString("hex")}`;
};

async function main() {
  if (!barbershopId) {
    usage();
    process.exitCode = 1;
    return;
  }

  const barbershop = await prisma.barbershops.findUnique({
    where: { id: barbershopId },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  if (!barbershop) {
    throw new Error("Barbearia nao encontrada");
  }

  const token = generateToken();
  const credential = await prisma.integration_credentials.create({
    data: {
      provider: PROVIDER,
      barbershop_id: barbershop.id,
      name,
      token_hash: hashToken(token),
      token_prefix: maskTokenPrefix(token),
      active: true
    }
  });

  console.log(
    JSON.stringify(
      {
        barbershop,
        credential: {
          id: credential.id,
          name: credential.name,
          tokenPrefix: credential.token_prefix,
          active: credential.active
        },
        token
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
