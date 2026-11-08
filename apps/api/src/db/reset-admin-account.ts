import "dotenv/config";

import { PrismaAdminAccountRepository } from "../auth/account-repository";
import { resetAdminAccount } from "../auth/reset-account";
import { createPrismaClient } from "./client";

/**
 * Recovery for an admin locked out of the sign-in page, run on the server:
 *   npm run admin:reset -w apps/api -- --all    back to ADMIN_USERNAME / ADMIN_PASSWORD_HASH
 *   npm run admin:reset -w apps/api -- --totp   turn two-step sign-in off
 *   npm run admin:reset -w apps/api -- --path   back to ADMIN_PATH
 * Every option also ends all sessions. Restart the application afterwards.
 */
const flags = new Set(process.argv.slice(2));
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required (see apps/api/.env.example)");
if (!["--all", "--totp", "--path"].some((flag) => flags.has(flag)))
  throw new Error("Choose what to reset: --all, --totp or --path");

const prisma = createPrismaClient(databaseUrl);
try {
  await resetAdminAccount(
    new PrismaAdminAccountRepository(prisma),
    { all: flags.has("--all"), totp: flags.has("--totp"), path: flags.has("--path") },
    {
      username: process.env.ADMIN_USERNAME?.trim() || "admin",
      passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() ?? ""
    },
    new Date()
  );
  console.log("Done. Restart the application for this to take effect.");
} finally {
  await prisma.$disconnect();
}
