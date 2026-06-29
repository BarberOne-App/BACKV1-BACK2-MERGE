export function HealthCheckUseCase() {
  return {
    status: "ok",
    provider: "areschat",
    version: "v1",
    timestamp: new Date().toISOString()
  };
}
