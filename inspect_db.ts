import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("--- BARBERSHOPS ---");
  const shops = await prisma.barbershops.findMany({
    select: { id: true, name: true, slug: true }
  });
  console.log(JSON.stringify(shops, null, 2));

  console.log("\n--- USERS ---");
  const users = await prisma.users.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      current_barbershop_id: true,
      user_barbershops: {
        select: { barbershop_id: true }
      }
    }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log("\n--- BARBERS ---");
  const barbers = await prisma.barbers.findMany({
    select: {
      id: true,
      display_name: true,
      barbershop_id: true,
      user_id: true
    }
  });
  console.log(JSON.stringify(barbers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
