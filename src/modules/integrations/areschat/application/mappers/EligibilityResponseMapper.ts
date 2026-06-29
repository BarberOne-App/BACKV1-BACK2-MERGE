type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
};

type Plan = {
  id: string;
  name: string;
  status: string;
};

export const mapEligibleCustomer = (customer: Customer, plan: Plan) => ({
  eligible: true,
  customer: {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    document: customer.cpf
  },
  plan,
  nextFlow: "eligible_customer",
  reason: null
});

export const mapIneligibleCustomer = (
  code: string,
  message: string,
  customer?: Customer | null
) => ({
  eligible: false,
  customer: customer
    ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        document: customer.cpf
      }
    : null,
  plan: null,
  nextFlow:
    code === "CUSTOMER_NOT_FOUND" ? "non_customer" : "customer_without_active_plan",
  reason: {
    code,
    message
  }
});
