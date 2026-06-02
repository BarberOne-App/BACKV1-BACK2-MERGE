import { AppError } from "./AppError.js";

export const badRequest = (msg = "Requisição inválida") => new AppError(400, msg);
export const unauthorized = (msg = "Não autorizado") => new AppError(401, msg);
export const forbidden = (msg = "Acesso negado") => new AppError(403, msg);
export const notFound = (msg = "Não encontrado") => new AppError(404, msg);
export const conflict = (msg = "Conflito") => new AppError(409, msg);

export { AppError };
