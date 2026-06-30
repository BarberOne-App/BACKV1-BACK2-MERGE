export interface IntegrationContext {
  provider: "areschat";
  tenantId: string;
  credentialId?: string | null;
  requestId: string | null;
}
