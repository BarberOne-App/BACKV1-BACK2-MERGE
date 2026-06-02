// src/protocols/serviceProtocols.ts
export type CreateServiceData = {
  name: string;
  basePrice: number;
  durationMinutes: number;
  imageUrl?: string | null;
  active?: boolean;
};

export type UpdateServiceData = Partial<CreateServiceData>;

export type ListServicesQuery = {
  q?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
};
