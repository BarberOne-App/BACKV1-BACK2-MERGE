import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("--- SUBSCRIPTIONS ---");
  const subs = await prisma.subscriptions.findMany({
    select: {
      id: true,
      user_id: true,
      users: { select: { name: true, email: true } },
      plan_id: true,
      subscription_plans: { select: { name: true } },
      status: true,
      monthly_barber_id: true,
      barbers: { select: { display_name: true } },
      barbershop_id: true,
      barbershops: { select: { name: true } }
    }
  });
  console.log(JSON.stringify(subs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
