export function mapCustomerToIntegrationDto(
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    cpf: string | null;
  },
  options?: {
    created?: boolean;
  }
) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    document: customer.cpf,
    created: options?.created === true
  };
}
