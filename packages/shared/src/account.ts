/** Second factor sent with a login, once the password alone was answered with TOTP_REQUIRED. */
export type AdminLoginSecondFactor = { totp?: string; recoveryCode?: string };

export type AdminSessionInfo = {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
};

export type AdminPathState = {
  /** Where the admin is served now. */
  current: string;
  /** A new address being tried; served alongside the current one until confirmed or cancelled. */
  pending: string | null;
  /** The address retired by the last switch: signed-in admins are redirected from it until then. */
  retiring: { path: string; until: string } | null;
};

/** GET /api/admin/account: the account and the protections in effect, never a secret. */
export type AdminAccountStatus = {
  username: string;
  /** "environment": still the server's configured account; "database": changed here since. */
  managedBy: "environment" | "database";
  /** False without a database: the account can only be changed in the server configuration. */
  editable: boolean;
  passwordChangedAt: string | null;
  totp: { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number };
  protections: {
    maxLoginAttempts: number;
    loginWindowMinutes: number;
    sessionTtlHours: number;
    trustProxy: boolean;
    allowedIps: number;
  };
  sessions: AdminSessionInfo[];
  path: AdminPathState;
};

export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_PASSWORD_MAX = 512;

export type AdminTotpSetup = {
  secret: string;
  otpauthUri: string;
  /** The same address as a QR code (an SVG image as a data URL). */
  qrCode: string;
};

export type AdminRecoveryCodes = { recoveryCodes: string[] };
