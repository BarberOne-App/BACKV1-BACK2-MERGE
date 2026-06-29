export const mapProfessionalToIntegrationDto = (barber: any) => ({
  id: barber.id,
  name: barber.display_name,
  displayName: barber.display_name,
  displayLabel: barber.display_name,
  active: true,
  specialty: barber.specialty ?? null,
  photoUrl: barber.photo_url ?? null,
  serviceIds: Array.isArray(barber.barber_services)
    ? barber.barber_services.map((item: any) => item.service_id)
    : []
});
