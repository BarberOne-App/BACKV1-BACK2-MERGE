export const mapServiceToIntegrationDto = (service: any) => ({
  id: service.id,
  name: service.name,
  displayName: service.name,
  displayLabel: service.name,
  active: service.active,
  durationMinutes: service.duration_minutes,
  basePrice: Number(service.base_price),
  promotionalPrice:
    service.promotional_price == null ? null : Number(service.promotional_price),
  coveredByPlan: Boolean(service.covered_by_plan),
  imageUrl: service.image_url ?? null
});
