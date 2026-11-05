import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Reader, type CountryResponse } from "maxmind";
import { z } from "zod";

import type { AnalyticsPreferences, AnalyticsPreferencesStatus } from "@liam-frost/shared";
import type { AnalyticsConfig } from "../config/env";
import { HttpError } from "../lib/errors";
import { IpList } from "../lib/ip-list";
import type { SettingsRepository } from "./types";

const KEY = "analytics.preferences.v1";
export const GEOIP_MAX_BYTES = 32 * 1024 ** 2;
export const analyticsPreferencesSchema = z
  .object({
    retentionDays: z.number().int().min(7).max(730),
    minGroupSize: z.number().int().min(1).max(50),
    rateLimitPerMinute: z.number().int().min(1).max(10_000),
    excludeIps: z
      .array(z.string().max(100))
      .max(500)
      .refine((entries) => {
        try {
          new IpList(entries);
          return true;
        } catch {
          return false;
        }
      }, "请输入有效的 IP 或 CIDR"),
    countryMode: z.enum(["environment", "none", "header", "database"]),
    countryHeader: z
      .string()
      .trim()
      .max(100)
      .regex(/^[a-zA-Z0-9-]*$/),
    databaseId: z.string().uuid().nullable()
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.countryMode === "header" && !v.countryHeader)
      ctx.addIssue({ code: "custom", path: ["countryHeader"], message: "请填写请求头名称" });
    if (v.countryMode === "database" && !v.databaseId)
      ctx.addIssue({ code: "custom", path: ["databaseId"], message: "请先上传 MMDB 数据库" });
  });

/** Database-backed overrides; environment values remain defaults, never rewritten. */
export class AnalyticsSettings {
  readonly config: AnalyticsConfig;
  readonly directory: string;
  private preferences: AnalyticsPreferences;
  private saved = false;
  error: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private database: AnalyticsPreferencesStatus["database"] = null;

  constructor(
    private readonly repo: SettingsRepository | null,
    private readonly defaults: AnalyticsConfig,
    uploads: string
  ) {
    this.config = { ...defaults };
    this.directory = join(uploads, ".analytics-geoip");
    this.preferences = this.defaultPreferences();
  }

  private defaultPreferences(): AnalyticsPreferences {
    return {
      retentionDays: this.defaults.retentionDays,
      minGroupSize: this.defaults.minGroupSize,
      rateLimitPerMinute: this.defaults.rateLimitPerMinute,
      excludeIps: [...this.defaults.excludeIps.entries],
      countryMode: "environment",
      countryHeader: this.defaults.countryHeader ?? "cf-ipcountry",
      databaseId: null
    };
  }

  async load() {
    const stored = await this.repo?.get(KEY);
    if (stored != null) {
      this.saved = true;
      try {
        this.preferences = analyticsPreferencesSchema.parse(stored);
        await this.apply(this.preferences);
      } catch {
        // Missing private files or a corrupt document must not take the site/admin offline,
        // nor silently discard privacy exclusions and resume collection with defaults.
        this.error = "统计设置或地理数据库不可用，采集已暂停。请修正设置或重新上传数据库后保存。";
      }
    }
  }

  status(): AnalyticsPreferencesStatus {
    return {
      values: structuredClone(this.preferences),
      editable: this.repo !== null,
      saved: this.saved,
      error: this.error,
      revision: createHash("sha256").update(JSON.stringify(this.preferences)).digest("hex"),
      timezone: this.config.timezone,
      database: this.database,
      environmentCountrySource: this.defaults.countryHeader
        ? "header"
        : this.defaults.geoipDb
          ? "geoip"
          : "none"
    };
  }

  private async inspect(id: string) {
    const bytes = await readFile(join(this.directory, `${z.string().uuid().parse(id)}.mmdb`));
    return this.validateDatabase(bytes, id);
  }

  private validateDatabase(bytes: Buffer, id: string) {
    if (!bytes.length || bytes.length > GEOIP_MAX_BYTES) throw new Error("size");
    const reader = new Reader<CountryResponse>(bytes);
    if (!/Country/i.test(reader.metadata.databaseType)) throw new Error("not-country");
    // Traverse representative IPv4/IPv6 addresses before accepting the database.
    reader.get("8.8.8.8");
    reader.get("2001:4860:4860::8888");
    return {
      id,
      type: reader.metadata.databaseType,
      builtAt: reader.metadata.buildEpoch.toISOString(),
      bytes: bytes.length
    };
  }

  private async apply(values: AnalyticsPreferences) {
    const database =
      values.countryMode === "database" && values.databaseId
        ? await this.inspect(values.databaseId)
        : null;
    const countryHeader =
      values.countryMode === "environment"
        ? this.defaults.countryHeader
        : values.countryMode === "header"
          ? values.countryHeader.toLowerCase()
          : null;
    const geoipDb =
      values.countryMode === "environment"
        ? this.defaults.geoipDb
        : database
          ? join(this.directory, `${database.id}.mmdb`)
          : null;
    Object.assign(this.config, {
      retentionDays: values.retentionDays,
      minGroupSize: values.minGroupSize,
      rateLimitPerMinute: values.rateLimitPerMinute,
      excludeIps: new IpList(values.excludeIps),
      countryHeader,
      geoipDb
    });
    this.preferences = values;
    this.database = database;
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }

  update(values: AnalyticsPreferences, revision: string, confirmRetention: boolean) {
    return this.serial(async () => {
      if (!this.repo)
        throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "需要数据库才能保存统计设置");
      if (revision !== this.status().revision)
        throw new HttpError(409, "SETTINGS_CHANGED", "设置已被修改，请刷新后重试");
      if (values.retentionDays < this.config.retentionDays && !confirmRetention)
        throw new HttpError(
          400,
          "RETENTION_CONFIRMATION_REQUIRED",
          "缩短保留期会永久删除过期的原始统计，请确认"
        );
      if (values.countryMode === "database" && values.databaseId) {
        try {
          await this.inspect(values.databaseId);
        } catch {
          throw new HttpError(400, "INVALID_DATABASE", "数据库不可用，请重新上传");
        }
      }
      await this.repo.set(KEY, values);
      await this.apply(values);
      this.saved = true;
      this.error = null;
      return this.status();
    });
  }

  upload(bytes: Buffer) {
    return this.serial(async () => {
      if (!this.repo)
        throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "需要数据库才能保存统计设置");
      const id = randomUUID();
      let database;
      try {
        database = this.validateDatabase(bytes, id);
      } catch {
        throw new HttpError(
          400,
          "INVALID_DATABASE",
          "请上传有效的 Country MMDB 数据库（最大 32 MiB）"
        );
      }
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      // Keep the active file and the two newest drafts. Never accept client paths or remote URLs.
      const old = (await readdir(this.directory)).filter((name) =>
        /^[a-f0-9-]{36}\.mmdb$/.test(name)
      );
      await writeFile(join(this.directory, `${id}.mmdb`), bytes, { mode: 0o600, flag: "wx" });
      const { stat } = await import("node:fs/promises");
      const inactive = (
        await Promise.all(
          old
            .filter((name) => name !== `${this.preferences.databaseId}.mmdb`)
            .map(async (name) => ({ name, time: (await stat(join(this.directory, name))).mtimeMs }))
        )
      ).sort((a, b) => b.time - a.time);
      for (const file of inactive.slice(1)) await rm(join(this.directory, file.name));
      return database;
    });
  }
}
