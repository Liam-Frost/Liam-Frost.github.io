import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

let prisma: PrismaClient | null = null;

export function hasDatabaseUrl(env = process.env) {
  return Boolean(env.DATABASE_URL?.trim());
}

export function createPrismaClient(connectionString: string) {
  // node-pg has no connect timeout by default; keep Prisma 6's 5s so an unreachable DB falls back to seed data quickly.
  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 });
  return new PrismaClient({ adapter });
}

export function getPrismaClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return null;
  }

  prisma ??= createPrismaClient(url);
  return prisma;
}

export async function disconnectPrismaClient() {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = null;
}
