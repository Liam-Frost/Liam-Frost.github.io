import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function hasDatabaseUrl(env = process.env) {
  return Boolean(env.DATABASE_URL?.trim());
}

export function getPrismaClient() {
  if (!hasDatabaseUrl()) {
    return null;
  }

  prisma ??= new PrismaClient();
  return prisma;
}

export async function disconnectPrismaClient() {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = null;
}
