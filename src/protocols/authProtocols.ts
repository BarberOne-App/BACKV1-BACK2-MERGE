export type LoginData = {
  email: string;
  password: string;
};

export type RegisterClientData = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

export type RegisterBarbershopData = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

export type RegisterBarberData = {
  name: string;
  email: string;
  phone?: string;
  password: string;

  // perfil do barbeiro
  displayName?: string;
  specialty?: string;
  photoUrl?: string;
  commissionPercent?: number;
};
