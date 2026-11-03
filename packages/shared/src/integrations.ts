/** Only these third-party settings are editable; server/security settings stay outside the admin. */
export const INTEGRATION_FIELDS = {
  tmdb: ["apiKey"],
  spotify: ["clientId", "clientSecret", "redirectUri"],
  googlebooks: ["apiKey"],
  igdb: ["clientId", "clientSecret"],
  steam: ["apiKey"]
} as const;

export type IntegrationProvider = keyof typeof INTEGRATION_FIELDS;
export type IntegrationField = "apiKey" | "clientId" | "clientSecret" | "redirectUri";
export type IntegrationValues = Partial<Record<IntegrationField, string>>;
export type IntegrationUpdate = {
  action: "save" | "disable" | "use-environment";
  /** Omitted or blank fields keep existing values. Disabling is a separate, explicit action. */
  values?: IntegrationValues;
};
export type IntegrationStatus = {
  configured: boolean;
  source: "admin" | "environment" | "unset";
  /** Presence only. Credentials are never returned, even to the admin. */
  fields: Partial<Record<IntegrationField, boolean>>;
  redirectUri: string | null;
};
export type AdminIntegrationsResponse = {
  editable: boolean;
  providers: Record<IntegrationProvider, IntegrationStatus>;
};
