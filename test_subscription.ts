import { createPagarmeClientSubscriptionService } from "./src/services/pagarmeSubscriptionService.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  try {
    console.log("Calling createPagarmeClientSubscriptionService...");
    const result = await createPagarmeClientSubscriptionService(
      {
        planId: "a280c0ea-35ba-413c-a69a-f5a842659145", // Plano De corte (has pagarme_plan_id in DB)
        cardToken: "card_xxx_test_token", // Mock card token
        customer: {
          name: "Test Customer",
          email: "customer@test.com",
          document: "12345678909",
          phone: "11999999999"
        }
      },
      {
        id: "ebfa26f8-e09c-459f-8787-90774931e725", // Novo Cliente
        name: "Novo Cliente",
        email: "novocliente@teste.com",
        barbershopId: "9965c58a-a69b-4ea7-b8df-0c81d611a286" // Barbearia Teste 3
      }
    );
    console.log("Success Result:", result);
  } catch (error: any) {
    console.error("Caught error:", error.message);
    if (error.details) {
      console.error("Error details:", JSON.stringify(error.details, null, 2));
    }
  }
}

run();
