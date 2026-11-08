-- The admin account once changed from the server's configured one, and its sign-in sessions.
CREATE TABLE "AdminCredential" (
    "id" TEXT NOT NULL DEFAULT 'admin',
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3),
    "sessionsNotBefore" INTEGER,
    "totpSecret" TEXT,
    "totpPendingSecret" TEXT,
    "totpPendingAt" TIMESTAMP(3),
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastStep" INTEGER,
    "recoveryCodes" JSONB NOT NULL DEFAULT '[]',
    "adminPath" TEXT,
    "adminPathPending" TEXT,
    "adminPathRetiring" TEXT,
    "adminPathRetireUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
