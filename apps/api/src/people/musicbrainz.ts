import type { PersonIdentity, PersonKind, PersonSearchResult } from "@liam-frost/shared";
import { z } from "zod";
import { SourceError } from "../media/sources";

const artistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: z.string().nullish(),
  disambiguation: z.string().nullish(),
  country: z.string().nullish(),
  aliases: z
    .array(
      z.object({ name: z.string(), locale: z.string().nullish(), primary: z.boolean().nullish() })
    )
    .max(2000)
    .optional(),
  relations: z
    .array(z.object({ url: z.object({ resource: z.string() }).optional() }))
    .max(2000)
    .optional()
});
type Artist = z.infer<typeof artistSchema>;
const parseArtist = (value: unknown): Artist => {
  const parsed = artistSchema.safeParse(value);
  if (!parsed.success) throw new SourceError("MusicBrainz 返回无效艺人资料");
  return parsed.data;
};
const kindOf = (artist: Artist): PersonKind =>
  ["Group", "Orchestra", "Choir"].includes(artist.type ?? "")
    ? "group"
    : artist.type === "Person" || !artist.type
      ? "person"
      : "organization";
export const identityUrl = (i: PersonIdentity) =>
  i.provider === "tmdb"
    ? `https://www.themoviedb.org/person/${i.externalId}`
    : i.provider === "musicbrainz"
      ? `https://musicbrainz.org/artist/${i.externalId}`
      : i.provider === "spotify"
        ? `https://open.spotify.com/artist/${i.externalId}`
        : `https://music.apple.com/artist/${i.externalId}`;

/** One process-wide queue: no polling, one request/second, bounded cache and no arbitrary URLs. */
let tail: Promise<unknown> = Promise.resolve(),
  nextAt = 0,
  queued = 0;
export function createMusicBrainz(fetchImpl: typeof fetch = fetch) {
  const cache = new Map<string, { until: number; data: unknown }>();
  const get = async (path: string) => {
    const kept = cache.get(path);
    if (kept && kept.until > Date.now()) return kept.data;
    if (queued >= 40) throw new SourceError("音乐资料请求正在排队，请稍后重试");
    queued++;
    const request = tail
      .catch(() => undefined)
      .then(async () => {
        const wait = Math.max(0, nextAt - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        nextAt = Date.now() + 1100;
        let response: Response;
        try {
          response = await fetchImpl(`https://musicbrainz.org/ws/2/${path}`, {
            redirect: "error",
            headers: {
              accept: "application/json",
              "user-agent":
                "LiamFrostPersonalSite/1.0 (https://github.com/Liam-Frost/Liam-Frost.github.io)"
            },
            signal: AbortSignal.timeout(12000)
          });
        } catch {
          throw new SourceError("MusicBrainz 暂时无法连接，请稍后重试");
        }
        if (!response.ok) {
          if (response.status === 429 || response.status === 503) {
            const retry = Number(response.headers.get("retry-after"));
            nextAt =
              Date.now() +
              Math.min(60000, Math.max(5000, Number.isFinite(retry) ? retry * 1000 : 5000));
          }
          await response.body?.cancel();
          throw new SourceError(`MusicBrainz 返回 HTTP ${response.status}，请稍后重试`);
        }
        const reader = response.body?.getReader();
        if (!reader) throw new SourceError("MusicBrainz 返回空响应");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > 1024 * 1024) {
              await reader.cancel();
              throw new SourceError("MusicBrainz 响应超出限制");
            }
            chunks.push(chunk.value);
          }
        } catch (error) {
          if (error instanceof SourceError) throw error;
          throw new SourceError("MusicBrainz 响应读取失败，请稍后重试");
        }
        let data: unknown;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          throw new SourceError("MusicBrainz 返回无效 JSON");
        }
        if (!data || typeof data !== "object") throw new SourceError("MusicBrainz 返回无效资料");
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(path, { until: Date.now() + 3600000, data });
        return data;
      });
    tail = request;
    try {
      return await request;
    } finally {
      queued--;
    }
  };
  return {
    async search(query: string): Promise<PersonSearchResult[]> {
      const data = (await get(
        `artist/?${new URLSearchParams({ query, dismax: "true", limit: "20", fmt: "json" })}`
      )) as { artists?: Artist[] };
      if (!Array.isArray(data.artists)) throw new SourceError("MusicBrainz 返回无效搜索结果");
      return data.artists
        .map(parseArtist)
        .filter((a) => /^[a-f0-9-]{36}$/.test(a.id) && a.name)
        .map((a) => ({
          source: "musicbrainz",
          sourceId: a.id,
          name: a.name,
          kind: kindOf(a),
          department: [a.type, a.country, a.disambiguation].filter(Boolean).join(" · "),
          knownFor: [],
          photoUrl: null,
          existingId: null
        }));
    },
    async artist(id: string) {
      if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))
        throw new SourceError("无效的 MusicBrainz 艺人ID");
      const a = parseArtist(await get(`artist/${id}?inc=aliases%2Burl-rels&fmt=json`));
      if (a.id !== id || typeof a.name !== "string" || !a.name || a.name.length > 120)
        throw new SourceError("MusicBrainz 返回无效艺人资料");
      const name: Record<string, string> = { en: a.name };
      for (const alias of a.aliases ?? []) {
        const locale =
          alias.locale === "zh_Hant" ? "zh-Hant" : alias.locale === "zh_Hans" ? "zh" : alias.locale;
        if (
          alias.name?.length <= 120 &&
          locale &&
          ["zh", "zh-Hant", "en", "ja", "fr"].includes(locale) &&
          alias.primary &&
          alias.name
        )
          name[locale] = alias.name;
      }
      const identities: PersonIdentity[] = [
        { provider: "musicbrainz", externalId: id, confirmed: true }
      ];
      for (const r of a.relations ?? []) {
        const spotify =
          /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})\/?$/.exec(
            r.url?.resource ?? ""
          );
        if (
          spotify &&
          !identities.some((i) => i.provider === "spotify" && i.externalId === spotify[1])
        )
          identities.push({ provider: "spotify", externalId: spotify[1], confirmed: false });
      }
      return {
        sourceId: id,
        sourceUrl: identityUrl(identities[0]!),
        kind: kindOf(a),
        name,
        originalName: a.name,
        aliases: [
          ...new Set(
            (a.aliases ?? [])
              .map((v) => v.name)
              .filter((v) => typeof v === "string" && Boolean(v) && v.length <= 120)
          )
        ].slice(0, 50),
        identities: identities.slice(0, 20),
        bio: {},
        links: identities.slice(1, 11).map(identityUrl),
        photoUrl: null
      };
    }
  };
}
