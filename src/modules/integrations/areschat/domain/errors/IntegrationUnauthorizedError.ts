export class IntegrationUnauthorizedError extends Error {
  constructor(message = "Token de integracao invalido") {
    super(message);
    this.name = "IntegrationUnauthorizedError";
  }
}
