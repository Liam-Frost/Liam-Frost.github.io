import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

let prisma: PrismaClient | null = null;

function readDatabaseUrl(env = process.env) {
  return env.DATABASE_URL?.trim() || null;
}

export function hasDatabaseUrl(env = process.env) {
  return Boolean(readDatabaseUrl(env));
}

// node-pg ignores Prisma's `?schema=` URL parameter, so pass it to the adapter explicitly.
function readSchema(connectionString: string) {
  try {
    return new URL(connectionString).searchParams.get("schema") ?? undefined;
  } catch {
    return undefined;
  }
}

export function createPrismaClient(connectionString: string) {
  // node-pg has no connect timeout by default; keep Prisma 6's 5s so an unreachable DB falls back to seed data quickly.
  const adapter = new PrismaPg(
    { connectionString, connectionTimeoutMillis: 5_000 },
    {
      schema: readSchema(connectionString),
      onPoolError: (error) => console.warn("PostgreSQL idle connection error:", error.message)
    }
  );
  return new PrismaClient({ adapter });
}

export function getPrismaClient() {
  const url = readDatabaseUrl();
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
