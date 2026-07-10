import type { NextFunction, Request, Response } from "express";
const WINDOW_MS = 15 * 60 * 1000; const MAX_REQUESTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();
export function publicLeadRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now(); const key = req.ip || req.socket.remoteAddress || "unknown"; const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + WINDOW_MS }); return next(); }
  if (current.count >= MAX_REQUESTS) { res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000)); return res.status(429).send({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }); }
  current.count += 1;
  if (attempts.size > 5000) for (const [attemptKey, value] of attempts) if (value.resetAt <= now) attempts.delete(attemptKey);
  return next();
}
