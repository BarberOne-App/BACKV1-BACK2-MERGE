import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { forbidden, unauthorized } from "../../../../../errors/index.js";
import {
  findActiveIntegrationCredentialByToken,
  touchIntegrationCredentialLastUsed
} from "../../infra/repositories/IntegrationCredentialRepository.js";

const getBearerToken = (req: Request) => {
  const auth = req.header("authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export function requireIntegrationAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  void (async () => {
    const receivedToken = getBearerToken(req);
    if (!receivedToken) {
      return next(unauthorized("Token de integracao ausente"));
    }

    const credential = await findActiveIntegrationCredentialByToken(
      receivedToken
    );

    if (credential) {
      const status = String(credential.barbershops?.status || "");
      if (status === "blocked" || status === "inactive") {
        return next(forbidden("Barbearia indisponivel para integracao"));
      }

      req.integration = {
        provider: "areschat",
        tenantId: credential.barbershop_id,
        credentialId: credential.id,
        requestId:
          req.header("x-request-id") ||
          `areschat_${crypto.randomUUID().replace(/-/g, "")}`
      };

      void touchIntegrationCredentialLastUsed(credential.id).catch(error => {
        console.error("[areschat] Falha ao atualizar last_used_at", error);
      });

      return next();
    }

    return next(unauthorized("Token de integracao invalido"));
  })().catch(error => next(error));
}
