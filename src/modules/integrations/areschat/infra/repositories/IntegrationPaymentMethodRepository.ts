import { getSettingsByBarbershop } from "../../../../../repository/settingRepository.js";

const DEFAULT_PAYMENT_METHODS = [
  {
    id: "pix",
    name: "Pix",
    type: "pix",
    description: "Pagamento instantaneo via Pix"
  },
  {
    id: "card",
    name: "Cartao",
    type: "card",
    description: "Pagamento por cartao"
  },
  {
    id: "local",
    name: "Pagar no local",
    type: "local",
    description: "Pagamento realizado presencialmente"
  }
];

const normalizeHidden = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => String(item || "").trim().toLowerCase())
    .flatMap(item => {
      if (item === "online") {
        return ["cartao", "pix"];
      }

      if (item === "card") {
        return ["cartao"];
      }

      return item;
    });
};

const isMethodHidden = (methodId: string, hidden: string[]) => {
  if (methodId === "card") {
    return hidden.includes("cartao") || hidden.includes("card");
  }

  if (methodId === "pix") {
    return hidden.includes("pix");
  }

  if (methodId === "local") {
    return hidden.includes("local");
  }

  return false;
};

export async function listPaymentMethodsForIntegration(params: {
  tenantId: string;
}) {
  const settings = await getSettingsByBarbershop(params.tenantId);
  const hidden = normalizeHidden(settings?.hidden_booking_payment_methods);

  return DEFAULT_PAYMENT_METHODS.filter(method => !isMethodHidden(method.id, hidden)).map(
    method => ({
      ...method,
      active: true
    })
  );
}
