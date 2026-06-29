export const mapPaymentMethodToIntegrationDto = (paymentMethod: {
  id: string;
  name: string;
  type: string;
  active: boolean;
  description?: string | null;
}) => ({
  id: paymentMethod.id,
  name: paymentMethod.name,
  displayName: paymentMethod.name,
  displayLabel: paymentMethod.name,
  active: paymentMethod.active,
  type: paymentMethod.type,
  description: paymentMethod.description ?? null
});
