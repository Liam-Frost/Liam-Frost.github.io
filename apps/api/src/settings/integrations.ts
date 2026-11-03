import {
  INTEGRATION_FIELDS,
  type AdminIntegrationsResponse,
  type IntegrationProvider,
  type IntegrationUpdate,
  type IntegrationValues
} from "@liam-frost/shared";
import { z } from "zod";

import type { AppConfig } from "../config/env";
import { HttpError } from "../lib/errors";
import { SecretBox } from "../lib/secret-box";
import type { SettingsRepository } from "./types";

const KEY = "integrations.credentials.v1";
const value = z
  .string()
  .trim()
  .max(4096)
  .refine((s) => !/[\r\n\0]/.test(s));
const valuesSchema = z
  .object({
    apiKey: value.optional(),
    clientId: value.optional(),
    clientSecret: value.optional(),
    redirectUri: value.optional()
  })
  .strict();
const storedSchema = z
  .object({
    tmdb: valuesSchema.optional(),
    spotify: valuesSchema.optional(),
    googlebooks: valuesSchema.optional(),
    igdb: valuesSchema.optional(),
    steam: valuesSchema.optional()
  })
  .strict();
export const integrationProviderSchema = z.enum([
  "tmdb",
  "spotify",
  "googlebooks",
  "igdb",
  "steam"
]);
export const integrationUpdateSchema = z
  .object({
    action: z.enum(["save", "disable", "use-environment"]),
    values: valuesSchema.optional()
  })
  .strict();
type Overrides = Partial<Record<IntegrationProvider, IntegrationValues>>;

/** One encrypted document, reused Setting table, serialized updates, no plaintext credentials in reads. */
export class IntegrationSettings {
  private overrides: Overrides = {};
  private queue: Promise<unknown> = Promise.resolve();
  private readonly defaults: Record<IntegrationProvider, IntegrationValues>;
  private readonly box: SecretBox;
  readonly editable: boolean;

  constructor(
    private readonly repo: SettingsRepository | null,
    config: AppConfig
  ) {
    this.editable = Boolean(
      repo && config.admin.configured && config.admin.sessionSecret.length >= 32
    );
    this.box = new SecretBox(config.admin.sessionSecret, "integration-credentials-v1");
    this.defaults = {
      tmdb: { apiKey: config.tmdbApiKey },
      spotify: config.spotify ?? {},
      googlebooks: { apiKey: config.googleBooksApiKey },
      igdb: config.twitch ?? {},
      steam: { apiKey: config.steamApiKey }
    };
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => {});
    return next;
  }

  private async load() {
    if (!this.editable) return;
    const stored = await this.repo!.get(KEY);
    if (stored === null || stored === undefined) {
      this.overrides = {};
      return;
    }
    const plain = typeof stored === "string" ? this.box.open(stored) : null;
    try {
      if (!plain) throw new Error();
      this.overrides = storedSchema.parse(JSON.parse(plain));
    } catch {
      // Do not silently re-enable an environment credential when the override cannot be decrypted.
      throw new HttpError(
        503,
        "INTEGRATIONS_UNREADABLE",
        "无法读取 API 配置，请检查备份恢复时是否保留了原 ADMIN_SESSION_SECRET"
      );
    }
  }

  refresh() {
    return this.serial(() => this.load());
  }
  values(provider: IntegrationProvider): IntegrationValues {
    return { ...(this.overrides[provider] ?? this.defaults[provider]) };
  }

  spotify() {
    const v = this.values("spotify");
    return v.clientId && v.clientSecret && v.redirectUri
      ? { clientId: v.clientId, clientSecret: v.clientSecret, redirectUri: v.redirectUri }
      : null;
  }

  media() {
    const igdb = this.values("igdb");
    return {
      tmdbKey: this.values("tmdb").apiKey,
      googleBooksKey: this.values("googlebooks").apiKey,
      twitch:
        igdb.clientId && igdb.clientSecret
          ? { clientId: igdb.clientId, clientSecret: igdb.clientSecret }
          : null
    };
  }

  status(): AdminIntegrationsResponse {
    const providers = {} as AdminIntegrationsResponse["providers"];
    for (const provider of Object.keys(INTEGRATION_FIELDS) as IntegrationProvider[]) {
      const v = this.values(provider);
      const configured = INTEGRATION_FIELDS[provider].every((field) => Boolean(v[field]));
      providers[provider] = {
        configured,
        source:
          this.overrides[provider] !== undefined ? "admin" : configured ? "environment" : "unset",
        fields: Object.fromEntries(
          INTEGRATION_FIELDS[provider].map((field) => [field, Boolean(v[field])])
        ),
        redirectUri: v.redirectUri || null
      };
    }
    return { editable: this.editable, providers };
  }

  update(provider: IntegrationProvider, patch: IntegrationUpdate) {
    return this.serial(async () => {
      if (!this.editable)
        throw new HttpError(
          503,
          "DATABASE_NOT_CONFIGURED",
          "API 配置需要数据库与已配置的管理员密钥"
        );
      await this.load();
      const next = structuredClone(this.overrides);
      if (patch.action === "use-environment") delete next[provider];
      else if (patch.action === "disable") next[provider] = {};
      else {
        const fields: readonly string[] = INTEGRATION_FIELDS[provider];
        if (Object.keys(patch.values ?? {}).some((field) => !fields.includes(field)))
          throw new HttpError(400, "VALIDATION", "此服务不支持这些配置字段");
        const v = this.values(provider);
        for (const field of INTEGRATION_FIELDS[provider]) {
          const replacement = patch.values?.[field]?.trim();
          if (replacement) v[field] = replacement;
        }
        if (!INTEGRATION_FIELDS[provider].every((field) => Boolean(v[field])))
          throw new HttpError(400, "VALIDATION", "请填写完整配置；已有字段留空即可保留");
        if (provider === "spotify") {
          const url = URL.parse(v.redirectUri!);
          if (
            !url ||
            url.username ||
            url.password ||
            url.hash ||
            url.search ||
            url.pathname !== "/api/admin/spotify/callback" ||
            !(
              url.protocol === "https:" ||
              (url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))
            )
          )
            throw new HttpError(
              400,
              "VALIDATION",
              "Spotify 回调地址须为本站 /api/admin/spotify/callback，使用 HTTPS（本机回环 IP 可用 HTTP）"
            );
        }
        next[provider] = v;
      }
      const beforeSpotify = JSON.stringify(this.values("spotify"));
      const afterSpotify = JSON.stringify(next.spotify ?? this.defaults.spotify);
      // An app change requires re-consent. New account records also bind tokens to their app identity.
      if (beforeSpotify !== afterSpotify) await this.repo!.set("spotify.account", null);
      await this.repo!.set(KEY, this.box.seal(JSON.stringify(next)));
      this.overrides = next;
      return this.status();
    });
  }
}
