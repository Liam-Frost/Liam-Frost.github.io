import {
  ANALYTICS_CONTENT_TYPES,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_PATHS,
  ANALYTICS_PLAY_SOURCES,
  ANALYTICS_PLAYERS,
  LANGS
} from "@liam-frost/shared";
import { z } from "zod";

export const MAX_BATCH = 50;
/** Longest visible time one engagement event may report. */
export const MAX_ENGAGED_SECONDS = 30 * 60;

const ID = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const TOKEN = z.string().regex(/^[a-z0-9_-]{1,40}$/);
const HOST = z
  .string()
  .max(100)
  .regex(/^[a-z0-9.-]+$/);

const eventSchema = z
  .object({
    id: ID,
    type: z.enum(ANALYTICS_EVENT_TYPES),
    sessionId: ID,
    path: z.enum(ANALYTICS_PATHS),
    contentType: z.enum(ANALYTICS_CONTENT_TYPES).optional(),
    contentId: z
      .string()
      .regex(/^[A-Za-z0-9_.:-]{1,80}$/)
      .optional(),
    target: z.string().max(100).optional(),
    detail: z.string().max(40).optional(),
    value: z.number().finite().optional(),
    lang: z.string().max(10).optional(),
    referrer: z.string().max(2048).optional(),
    utm: z
      .object({
        source: z.string().max(200).optional(),
        medium: z.string().max(200).optional(),
        campaign: z.string().max(200).optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const batchSchema = z
  .object({ events: z.array(z.unknown()).min(1).max(MAX_BATCH) })
  .strict();

export type ValidEvent = {
  id: string;
  type: (typeof ANALYTICS_EVENT_TYPES)[number];
  sessionId: string;
  path: string;
  contentType: string | null;
  contentId: string | null;
  target: string | null;
  detail: string | null;
  value: number | null;
  lang: string | null;
  referrer: string | null;
  utm: { source: string | null; medium: string | null; campaign: string | null };
};

/** A host name without "www.", or null for anything that is not an http(s) address. */
export function hostOf(address: string) {
  try {
    const url = new URL(address);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

const utmValue = (value: string | undefined) => {
  const clean = value?.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 64);
  return clean || null;
};

/**
 * Checks one event and keeps only what its type uses. `siteHost` drops referrers from the site itself.
 * Returns null for anything malformed, so a bad event never fails the rest of the batch.
 */
export function validateEvent(raw: unknown, siteHost: string): ValidEvent | null {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  const event: ValidEvent = {
    id: e.id,
    type: e.type,
    sessionId: e.sessionId,
    path: e.path,
    contentType: null,
    contentId: null,
    target: null,
    detail: null,
    value: null,
    lang: null,
    referrer: null,
    utm: { source: null, medium: null, campaign: null }
  };

  switch (e.type) {
    case "page_view": {
      event.lang = (LANGS as readonly string[]).includes(e.lang ?? "") ? e.lang! : null;
      const referrer = e.referrer ? hostOf(e.referrer) : null;
      event.referrer = referrer && referrer !== siteHost.replace(/^www\./, "") ? referrer : null;
      event.utm = {
        source: utmValue(e.utm?.source),
        medium: utmValue(e.utm?.medium),
        campaign: utmValue(e.utm?.campaign)
      };
      return event;
    }
    case "content_view":
      if (!e.contentType || !e.contentId) return null;
      return { ...event, contentType: e.contentType, contentId: e.contentId };
    case "music_play": {
      const player = (ANALYTICS_PLAYERS as readonly string[]).includes(e.target ?? "");
      const source = (ANALYTICS_PLAY_SOURCES as readonly string[]).includes(e.detail ?? "");
      if (!e.contentId || !player || !source) return null;
      return {
        ...event,
        contentType: "media",
        contentId: e.contentId,
        target: e.target!,
        detail: e.detail!
      };
    }
    case "outbound_click": {
      const host = HOST.safeParse(e.target?.toLowerCase().replace(/^www\./, ""));
      if (!host.success) return null;
      const detail = e.detail ? TOKEN.safeParse(e.detail) : null;
      return { ...event, target: host.data, detail: detail?.success ? detail.data : null };
    }
    case "collection_filter": {
      const tab = TOKEN.safeParse(e.target);
      if (!tab.success) return null;
      const view = e.detail ? TOKEN.safeParse(e.detail) : null;
      return { ...event, target: tab.data, detail: view?.success ? view.data : null };
    }
    case "engagement":
      if (e.value === undefined || e.value < 1) return null;
      return { ...event, value: Math.min(Math.round(e.value), MAX_ENGAGED_SECONDS) };
  }
}

/**
 * Crawlers, link previews, headless browsers and scripts. Most never run the site's JavaScript; this
 * catches the ones that do.
 */
const BOT =
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl\/|wget\/|python|go-http|java\/|okhttp|axios|node-fetch|undici|phantomjs|puppeteer|playwright|selenium/i;

export function isBot(userAgent: string | undefined) {
  return !userAgent || userAgent.length < 20 || BOT.test(userAgent);
}

/** Phone, tablet or desktop from the User-Agent. */
export function deviceOf(userAgent: string) {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(userAgent)) return "tablet";
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** The browser family; versions are not kept. */
export function browserOf(userAgent: string) {
  if (/Edg(e|A|iOS)?\//.test(userAgent)) return "edge";
  if (/OPR\/|Opera/.test(userAgent)) return "opera";
  if (/SamsungBrowser\//.test(userAgent)) return "samsung";
  if (/Firefox\/|FxiOS\//.test(userAgent)) return "firefox";
  if (/Chrome\/|CriOS\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "other";
}

/**
 * Drops a repeat of the same play or click from the same session within a second (double clicks,
 * a player reporting the same song twice). Real repeats a second apart still count.
 */
export class RepeatFilter {
  private readonly last = new Map<string, number>();

  constructor(private readonly windowMs = 1000) {}

  repeat(event: ValidEvent, now: number) {
    if (event.type !== "music_play" && event.type !== "outbound_click") return false;
    const key = `${event.sessionId}|${event.type}|${event.contentId ?? event.target}`;
    const previous = this.last.get(key);
    this.last.set(key, now);
    if (this.last.size > 10_000) {
      for (const [k, at] of this.last) if (now - at > this.windowMs) this.last.delete(k);
    }
    return previous !== undefined && now - previous < this.windowMs;
  }
}
