import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { SettingsRepository } from "./types";

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string) {
    const record = await this.prisma.setting.findUnique({ where: { key } });
    return record?.value ?? null;
  }

  async set(key: string, value: unknown) {
    const json = value as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
  }
}
