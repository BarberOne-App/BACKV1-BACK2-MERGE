// import jwt, { SignOptions } from "jsonwebtoken";

// const secret = process.env.JWT_SECRET || "dev-secret";

// export type TokenPayload = {
//   userId: string;
//   role: "admin" | "barber" | "client";
//   isAdmin: boolean;
//   iat?: number;
//   exp?: number;
// };

// const signOptions: SignOptions = {
//   expiresIn: process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN, 10) : "24h",
// };

// export function signToken(payload: object) {
//   return jwt.sign(payload, secret, signOptions);
// }

// export function verifyToken(token: string): TokenPayload {
//   return jwt.verify(token, secret) as TokenPayload;
// }

import jwt, { SignOptions } from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "dev-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export type TokenPayload = {
  userId: string;
  barbershopId: string | null;
  role: "admin" | "barber" | "client" | "receptionist" | "super_admin";
  isAdmin: boolean;
  iat?: number;
  exp?: number;
};

const accessOptions: SignOptions = {
  expiresIn: (process.env.JWT_EXPIRES_IN || "24h") as any,
};

const refreshOptions: SignOptions = {
  expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as any,
};

type PayloadInput = Omit<TokenPayload, "iat" | "exp">;

/** Gera access token (curta duração) */
export function signToken(payload: PayloadInput) {
  return jwt.sign(payload, secret, accessOptions);
}

/** Gera refresh token (longa duração) */
export function signRefreshToken(payload: PayloadInput) {
  return jwt.sign(payload, refreshSecret, refreshOptions);
}

/** Verifica access token */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

/** Verifica refresh token */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, refreshSecret) as TokenPayload;
}
