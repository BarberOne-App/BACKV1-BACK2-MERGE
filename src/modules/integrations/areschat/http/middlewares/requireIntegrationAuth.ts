import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { unauthorized } from "../../../../../errors/index.js";
import { IntegrationConfigurationError } from "../../domain/errors/IntegrationConfigurationError.js";

const getBearerToken = (req: Request) => {
  const auth = req.header("authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const getConfiguredToken = () => {
  const token = String(process.env.ARESCHAT_INTEGRATION_TOKEN || "").trim();
  if (!token) {
    throw new IntegrationConfigurationError(
      "ARESCHAT_INTEGRATION_TOKEN nao configurado"
    );
  }

  return token;
};

const getConfiguredTenantId = () => {
  const tenantId = String(
    process.env.ARESCHAT_INTEGRATION_BARBERSHOP_ID || ""
  ).trim();

  if (!tenantId) {
    throw new IntegrationConfigurationError(
      "ARESCHAT_INTEGRATION_BARBERSHOP_ID nao configurado"
    );
  }

  return tenantId;
};

export function requireIntegrationAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const receivedToken = getBearerToken(req);
    if (!receivedToken) {
      return next(unauthorized("Token de integracao ausente"));
    }

    const configuredToken = getConfiguredToken();
    if (receivedToken !== configuredToken) {
      return next(unauthorized("Token de integracao invalido"));
    }

    req.integration = {
      provider: "areschat",
      tenantId: getConfiguredTenantId(),
      requestId:
        req.header("x-request-id") ||
        `areschat_${crypto.randomUUID().replace(/-/g, "")}`
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
