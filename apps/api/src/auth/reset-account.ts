import type { AdminAccountRepository, AdminAccountRow } from "./account-repository";

export type AdminResetOptions = { all?: boolean; totp?: boolean; path?: boolean };
export type AdminResetEnv = { username: string; passwordHash: string };

/**
 * Recovery for an admin locked out of the sign-in page. Every option also ends all sessions, and
 * for good: a signed cookie stays valid by itself, so the account keeps a cutoff and the session
 * rows are marked revoked rather than removed. That is why `all` restores the configured account
 * into the row instead of deleting it.
 */
export async function resetAdminAccount(
  repo: AdminAccountRepository,
  options: AdminResetOptions,
  env: AdminResetEnv,
  now: Date
) {
  const current = await repo.loadAccount();
  if (!current && !env.passwordHash)
    throw new Error("ADMIN_PASSWORD_HASH is required when no account has been saved yet");
  const base: AdminAccountRow = current ?? {
    username: env.username,
    passwordHash: env.passwordHash,
    passwordChangedAt: null,
    sessionsNotBefore: null,
    totpSecret: null,
    totpPendingSecret: null,
    totpPendingAt: null,
    totpEnabledAt: null,
    totpLastStep: null,
    recoveryCodes: [],
    adminPath: null,
    adminPathPending: null,
    adminPathRetiring: null,
    adminPathRetireUntil: null
  };
  const clearTotp = options.all || options.totp;
  const clearPath = options.all || options.path;
  await repo.saveAccount({
    ...base,
    ...(options.all
      ? { username: env.username, passwordHash: env.passwordHash, passwordChangedAt: null }
      : {}),
    ...(clearTotp
      ? {
          totpSecret: null,
          totpPendingSecret: null,
          totpPendingAt: null,
          totpEnabledAt: null,
          totpLastStep: null,
          recoveryCodes: []
        }
      : {}),
    ...(clearPath
      ? {
          adminPath: null,
          adminPathPending: null,
          adminPathRetiring: null,
          adminPathRetireUntil: null
        }
      : {}),
    // One second ahead: a session signed in the same second as the reset must not count either.
    sessionsNotBefore: Math.floor(now.getTime() / 1000) + 1
  });
  await repo.revokeSessionsExcept(null, now);
}
