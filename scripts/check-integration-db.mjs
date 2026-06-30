import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [dbInfo] = await prisma.$queryRawUnsafe(`
    select
      current_database() as database,
      current_user as "user",
      current_schema() as schema,
      now() as server_time
  `);

  const tables = await prisma.$queryRawUnsafe(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('barbershops', 'integration_credentials')
    order by table_name
  `);

  const barbershops = await prisma.$queryRawUnsafe(`
    select id, name, slug, status
    from barbershops
    order by created_at desc
    limit 10
  `);

  const credentials = await prisma.$queryRawUnsafe(`
    select
      provider,
      barbershop_id as "barbershopId",
      token_prefix as "tokenPrefix",
      active,
      last_used_at as "lastUsedAt",
      revoked_at as "revokedAt"
    from integration_credentials
    order by created_at desc
    limit 10
  `);

  console.log(
    JSON.stringify(
      {
        dbInfo,
        tables,
        barbershops,
        credentials
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
