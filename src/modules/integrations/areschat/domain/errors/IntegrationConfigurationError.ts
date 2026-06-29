export class IntegrationConfigurationError extends Error {
  constructor(message = "Integracao AresChat nao configurada") {
    super(message);
    this.name = "IntegrationConfigurationError";
  }
}
