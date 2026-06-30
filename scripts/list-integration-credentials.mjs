import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [, , barbershopId] = process.argv;

async function main() {
  const credentials = await prisma.integration_credentials.findMany({
    where: {
      provider: "areschat",
      ...(barbershopId ? { barbershop_id: barbershopId } : {})
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
    },
    orderBy: {
      created_at: "desc"
    }
  });

  console.log(
    JSON.stringify(
      {
        total: credentials.length,
        credentials: credentials.map(credential => ({
          id: credential.id,
          provider: credential.provider,
          name: credential.name,
          tokenPrefix: credential.token_prefix,
          active: credential.active,
          revokedAt: credential.revoked_at,
          lastUsedAt: credential.last_used_at,
          createdAt: credential.created_at,
          updatedAt: credential.updated_at,
          barbershop: {
            id: credential.barbershops.id,
            name: credential.barbershops.name,
            slug: credential.barbershops.slug,
            status: credential.barbershops.status
          }
        }))
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
