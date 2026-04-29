export type AdminAuthConfig = {
  configured: boolean;
  username: string;
  passwordHash: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  cookieName: string;
  cookieSecure: boolean;
};

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAdminAuthConfig(env = process.env): AdminAuthConfig {
  const username = env.ADMIN_USERNAME?.trim() ?? "";
  const passwordHash = env.ADMIN_PASSWORD_HASH?.trim() ?? "";
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim() ?? "";

  return {
    configured: Boolean(username && passwordHash && sessionSecret),
    username,
    passwordHash,
    sessionSecret,
    sessionTtlSeconds: readPositiveInteger(env.ADMIN_SESSION_TTL_SECONDS, 60 * 60 * 8),
    cookieName: env.ADMIN_COOKIE_NAME?.trim() || "lf_admin_session",
    cookieSecure: env.ADMIN_COOKIE_SECURE === "true" || env.NODE_ENV === "production"
  };
}
