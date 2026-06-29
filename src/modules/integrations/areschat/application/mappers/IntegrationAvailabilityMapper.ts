export const mapAvailabilityToIntegrationDto = (params: {
  date: string;
  professionalId: string;
  slots: string[];
}) => ({
  date: params.date,
  professionalId: params.professionalId,
  slots: params.slots.map(slot => ({
    id: slot,
    time: slot,
    displayName: slot,
    displayLabel: slot,
    available: true
  }))
});
