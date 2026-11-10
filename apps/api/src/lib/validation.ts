import {
  ABOUT_LIMITS,
  MANIFESTO_ROTATION_MODES,
  PERSON_ROLES,
  ROTATION_MODES,
  SOUNDTRACK_ROLES
} from "@liam-frost/shared";
import { z } from "zod";

import { badRequest } from "./errors";

export const loginSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required").max(100),
    password: z.string().min(1, "Password is required").max(512),
    totp: z.string().trim().max(10).optional(),
    recoveryCode: z.string().trim().max(40).optional()
  })
  .strict();

export const photoParamsSchema = z.object({
  id: z.string().min(1).max(200)
});

/** Parses input with a Zod schema; throws a 400 HttpError with the first issue's message. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input ?? {});
  if (result.success) {
    return result.data;
  }

  throw badRequest(result.error.issues[0]?.message ?? "Invalid request", "VALIDATION");
}

const LANG_KEYS = ["zh", "zh-Hant", "en", "fr", "ja"] as const;

/** Text per language; empty strings are dropped so "cleared" languages fall back on the site. */
function localizedText(max: number) {
  return z
    .object(
      Object.fromEntries(
        LANG_KEYS.map((lang) => [lang, z.string().trim().max(max).optional()])
      ) as Record<(typeof LANG_KEYS)[number], z.ZodOptional<z.ZodString>>
    )
    .strict()
    .transform(
      (value) =>
        Object.fromEntries(Object.entries(value).filter(([, text]) => text)) as Partial<
          Record<(typeof LANG_KEYS)[number], string>
        >
    );
}

const requiredText = (max: number, message: string) =>
  localizedText(max).refine((value) => Object.keys(value).length > 0, message);

/** Optional text: null or an object with no text clears it. */
const clearableText = (max: number) =>
  localizedText(max)
    .nullable()
    .transform((value) => (value && Object.keys(value).length ? value : null));

/** Optional plain string: null or "" clears it. */
const clearableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const photoIdSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/, "Invalid photo id")
});

export const photoUpdateSchema = z
  .object({
    title: requiredText(120, "Title is required in at least one language"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date"),
    category: localizedText(40),
    location: clearableText(120),
    camera: clearableString(120),
    lens: clearableString(120),
    settings: clearableString(120),
    description: clearableText(1000),
    tags: z.array(localizedText(40)).max(20, "At most 20 tags"),
    alt: localizedText(300),
    visibility: z.enum(["public", "private"]),
    featured: z.boolean()
  })
  .partial()
  .strict();

export const photoOrderSchema = z
  .object({
    ids: z.array(photoIdSchema.shape.id).max(10_000)
  })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, "Duplicate ids in order");

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "Invalid id");

export const projectIdSchema = z.object({ id: uuid });

/** Ids of linked records (projects ↔ technologies of the stack), each once. */
const linkIds = (max: number, what: string) =>
  z
    .array(uuid)
    .max(max, `At most ${max} ${what}`)
    .refine((ids) => new Set(ids).size === ids.length, `Duplicate ${what}`);

/** Most technologies a project links, and most projects a technology links. */
export const MAX_PROJECT_TECHNOLOGIES = 40;
export const MAX_TECHNOLOGY_PROJECTS = 500;
const photoImportFrom = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), url: z.string().trim().url().max(2048) }).strict(),
  z.object({ type: z.literal("gallery"), url: z.string().trim().url().max(2048) }).strict(),
  z
    .object({
      type: z.literal("server"),
      root: z.number().int().min(0).max(50),
      path: z.string().min(1).max(1024)
    })
    .strict()
]);

/** Adding a photo from a link, a gallery photo or a server file; server files are always hosted. */
export const photoImportSchema = z
  .object({ from: photoImportFrom, mode: z.enum(["import", "reference"]).default("import") })
  .strict()
  .refine((value) => value.from.type !== "server" || value.mode === "import", {
    message: "Server files are always hosted by the site"
  });

export const photoImageReplaceSchema = z
  .object({
    from: photoImportFrom,
    mode: z.enum(["import", "reference"]).default("import"),
    useExif: z.boolean().optional(),
    current: z.boolean().optional()
  })
  .strict()
  .refine((value) => value.from.type !== "server" || value.mode === "import", {
    message: "Server files are always hosted by the site"
  });

export const photoVersionParamsSchema = z.object({
  id: photoIdSchema.shape.id,
  versionId: z.string().regex(/^[a-f0-9-]{36}$/, "Invalid version id")
});
export const trashItemParamsSchema = z.object({
  kind: z.enum(["photo", "version"]),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/, "Invalid id")
});
export const photoVersionLabelSchema = z.object({ label: z.string().trim().max(60) }).strict();

const uploadId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Invalid upload id");
export const uploadIdSchema = uploadId;

export const uploadCheckSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            name: z.string().min(1).max(300),
            sha256: z.string().regex(/^[a-f0-9]{64}$/, "Invalid hash")
          })
          .strict()
      )
      .max(500)
  })
  .strict();

export const uploadStatusSchema = z.object({ ids: z.array(uploadId).max(500) }).strict();

export const serverFileQuerySchema = z
  .object({
    root: z.coerce.number().int().min(0).max(50).default(0),
    path: z.string().max(1024).optional()
  })
  .strict();

export const projectImageParamsSchema = z.object({
  id: uuid,
  imageId: z.string().regex(/^[a-z0-9]{12}$/, "Invalid image id")
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, digits and single hyphens"
  )
  .max(80, "Slug is at most 80 characters");

export const projectSlugParamsSchema = z.object({ slug: slugSchema });

/** Year and month, e.g. "2025-06"; null or "" clears it. */
const yearMonth = z
  .string()
  .trim()
  .regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/, "Dates must be YYYY-MM")
  .nullable()
  .transform((value) => value || null);

/** http(s) link; "" clears it. */
const link = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Links must be http(s) URLs")
  .optional();

export const projectCreateSchema = z
  .object({
    title: requiredText(120, "Title is required in at least one language"),
    slug: slugSchema
  })
  .strict();

export const projectUpdateSchema = z
  .object({
    slug: slugSchema,
    title: requiredText(120, "Title is required in at least one language"),
    summary: localizedText(300),
    body: localizedText(20_000),
    technologyIds: linkIds(MAX_PROJECT_TECHNOLOGIES, "technologies"),
    otherTechnologies: z
      .array(z.string().trim().min(1).max(30))
      .max(20, "At most 20 other technologies")
      .refine(
        (list) => new Set(list.map((t) => t.toLowerCase())).size === list.length,
        "Duplicate technology"
      ),
    links: z
      .object({ repo: link, demo: link, docs: link })
      .strict()
      .transform(
        (value) =>
          Object.fromEntries(Object.entries(value).filter(([, url]) => url)) as {
            repo?: string;
            demo?: string;
            docs?: string;
          }
      ),
    status: z.enum(["in-progress", "completed", "archived"]),
    startedAt: yearMonth,
    endedAt: yearMonth,
    featured: z.boolean(),
    visibility: z.enum(["public", "private"]),
    gallery: z.array(projectImageParamsSchema.shape.imageId).max(30)
  })
  .partial()
  .strict();

export const projectOrderSchema = z
  .object({ ids: z.array(uuid).max(1000) })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, "Duplicate ids in order");

export const projectImageSlotSchema = z.object({ slot: z.enum(["cover", "gallery"]) });

const mediaKind = z.enum(["movie", "tv", "anime", "book", "comic", "game", "track", "album"]);
/** Kinds added by searching a source or by hand (songs have their own routes). */
const watchKind = z.enum(["movie", "tv", "anime", "book", "comic", "game"]);
const searchSource = z.enum(["tmdb", "bangumi", "openlibrary", "googlebooks", "anilist", "igdb"]);

/** Which sources each kind is searched on. */
const KIND_SOURCES: Record<z.infer<typeof watchKind>, readonly string[]> = {
  movie: ["tmdb"],
  tv: ["tmdb"],
  anime: ["bangumi", "tmdb"],
  book: ["openlibrary", "googlebooks", "bangumi"],
  comic: ["anilist", "bangumi"],
  game: ["igdb"]
};
const SOURCE_IDS: Record<z.infer<typeof searchSource>, RegExp> = {
  tmdb: /^(movie|tv):\d{1,12}$/,
  bangumi: /^\d{1,12}$/,
  openlibrary: /^OL\d{1,12}W$/,
  googlebooks: /^[A-Za-z0-9_-]{12}$/,
  anilist: /^\d{1,9}$/,
  igdb: /^\d{1,12}$/
};

export const mediaIdSchema = projectIdSchema;
export const mediaListQuerySchema = z.object({ kind: mediaKind.optional() });
export const mediaFeaturedOrderSchema = z
  .object({ ids: z.array(uuid).max(1000) })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, "Duplicate ids in order");

export const mediaCreateSchema = z
  .object({
    kind: watchKind,
    title: requiredText(200, "Title is required in at least one language")
  })
  .strict();

export const mediaImportSchema = z
  .object({
    kind: watchKind,
    source: searchSource,
    sourceId: z.string().trim().max(40)
  })
  .strict()
  .refine(
    (value) => KIND_SOURCES[value.kind].includes(value.source),
    "This source has no entries of that kind"
  )
  .refine((value) => SOURCE_IDS[value.source].test(value.sourceId), "Invalid source id");

export const mediaSearchQuerySchema = z
  .object({
    kind: watchKind,
    source: searchSource,
    q: z.string().trim().min(1, "Enter a title to search").max(100)
  })
  .refine(
    (value) => KIND_SOURCES[value.kind].includes(value.source),
    "This source has no entries of that kind"
  );

/** An https URL on one of the given hosts; null or "" clears it. */
const hostLink = (hosts: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && hosts.test(url.hostname);
      } catch {
        return false;
      }
    }, message)
    .transform((value) => value || null);

/** Previews play in visitors' browsers; only iTunes' and Spotify's preview CDNs. */
const previewLink = hostLink(
  /^(audio-ssl\.itunes\.apple\.com|p\.scdn\.co)$/,
  "Previews must come from iTunes or Spotify"
);
const appleLink = hostLink(/^music\.apple\.com$/, "Must be an Apple Music link");

export const musicSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Enter a song to search").max(100),
  country: z.enum(["US", "JP", "GB", "FR", "CN", "TW", "HK"]).default("US")
});

export const musicImportSchema = z
  .object({
    itunesId: z.string().regex(/^\d{1,15}$/, "Invalid iTunes id"),
    country: z.enum(["US", "JP", "GB", "FR", "CN", "TW", "HK"]).default("US")
  })
  .strict();

/** Where the browser returns after connecting Spotify: an http(s) URL (the admin page that started it). */
export const spotifyConnectSchema = z
  .object({
    returnTo: z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "Invalid return address")
  })
  .strict();

export const spotifyCallbackQuerySchema = z.object({
  state: z.string().regex(/^[0-9a-f]{32}$/),
  code: z.string().max(2048).optional(),
  error: z.string().max(200).optional()
});

export const musicAccountImportSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("liked") }).strict(),
  z
    .object({
      source: z.literal("playlist"),
      playlistId: z.string().regex(/^[A-Za-z0-9]{22}$/, "Invalid playlist id")
    })
    .strict()
]);

export const playlistImportSchema = z
  .object({ playlistUrl: z.string().trim().min(1, "Enter a playlist link").max(500) })
  .strict();
export const musicJobParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/, "Invalid job id")
});

/** YYYY-MM-DD; null or "" clears it. */
const isoDate = z
  .string()
  .trim()
  .regex(/^$|^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Dates must be YYYY-MM-DD")
  // The format allows 2026-02-31; a real date survives a round trip through Date. (Refinements also run
  // after a failed regex, so invalid input must not throw here.)
  .refine((value) => {
    if (!value) return true;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Invalid date")
  .nullable()
  .transform((value) => value || null);

export const mediaUpdateSchema = z
  .object({
    title: requiredText(200, "Title is required in at least one language"),
    originalTitle: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .transform((value) => value || null),
    year: z.number().int().min(1870).max(2100).nullable(),
    genres: z.array(requiredText(40, "Genre names cannot be empty")).max(20, "At most 20 genres"),
    credits: z.array(z.string().trim().min(1).max(100)).max(20, "At most 20 credits"),
    overview: localizedText(5000),
    status: z.enum(["want", "watching", "done", "dropped"]),
    rating: z.number().int().min(1, "Ratings are 1-5").max(5, "Ratings are 1-5").nullable(),
    review: localizedText(5000),
    watchedOn: isoDate,
    rewatchCount: z.number().int().min(0).max(999),
    progress: z
      .object({
        watched: z.number().int().min(0).max(100_000),
        total: z.number().int().min(1).max(100_000).nullable()
      })
      .strict()
      .refine(
        (value) => value.total === null || value.watched <= value.total,
        "Watched episodes exceed the total"
      )
      .nullable(),
    music: z
      .object({
        album: z
          .string()
          .trim()
          .max(200)
          .nullable()
          .transform((value) => value || null),
        previewUrl: previewLink,
        appleUrl: appleLink
      })
      .partial()
      .strict(),
    publication: z
      .object({
        publisher: clearableString(200),
        pages: z.number().int().min(1).max(100_000).nullable(),
        volumes: z.number().int().min(1).max(10_000).nullable(),
        ongoing: z.boolean().nullable()
      })
      .partial()
      .strict(),
    game: z
      .object({
        platforms: z.array(z.string().trim().min(1).max(60)).max(20, "At most 20 platforms"),
        publishers: z.array(z.string().trim().min(1).max(100)).max(10, "At most 10 publishers"),
        playtimeHours: z.number().int().min(0).max(100_000).nullable(),
        purchasedOn: isoDate
      })
      .partial()
      .strict(),
    inPlayer: z.boolean(),
    featured: z.boolean(),
    visibility: z.enum(["public", "private"])
  })
  .partial()
  .strict();

/** Bulk actions: up to 500 distinct ids; an update needs at least one change. */
function batchSchema<T extends z.ZodType>(patch: T) {
  return z
    .discriminatedUnion("action", [
      z
        .object({
          action: z.literal("delete"),
          ids: z.array(uuid).min(1).max(500, "At most 500 at a time")
        })
        .strict(),
      z
        .object({
          action: z.literal("update"),
          ids: z.array(uuid).min(1).max(500, "At most 500 at a time"),
          patch
        })
        .strict()
    ])
    .refine((value) => new Set(value.ids).size === value.ids.length, "Duplicate ids");
}

const batchVisibility = { visibility: z.enum(["public", "private"]), featured: z.boolean() };

export const mediaBatchSchema = batchSchema(
  z
    .object({
      ...batchVisibility,
      status: z.enum(["want", "watching", "done", "dropped"]),
      inPlayer: z.boolean()
    })
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, "Nothing to change")
);

export const personBatchSchema = batchSchema(
  z
    .object(batchVisibility)
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, "Nothing to change")
);

export const playlistIdSchema = projectIdSchema;

export const playlistCreateSchema = z
  .object({
    name: requiredText(120, "Name is required in at least one language"),
    description: localizedText(1000).optional()
  })
  .strict();

export const playlistUpdateSchema = z
  .object({
    name: requiredText(120, "Name is required in at least one language"),
    description: localizedText(1000),
    visibility: z.enum(["public", "private"])
  })
  .partial()
  .strict();

export const playlistTracksSchema = z
  .object({
    action: z.enum(["add", "remove"]),
    ids: z.array(uuid).min(1).max(1000, "At most 1000 at a time")
  })
  .strict();

export const playlistOrderSchema = z
  .object({ ids: z.array(uuid).max(5000) })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, "Duplicate ids in order");

export const collectionSettingsSchema = z
  .object({
    // Settings saved before a kind existed have no switch for it; it is shown.
    show: z
      .object({
        movie: z.boolean(),
        tv: z.boolean(),
        anime: z.boolean(),
        book: z.boolean().default(true),
        comic: z.boolean().default(true),
        game: z.boolean().default(true),
        music: z.boolean(),
        people: z.boolean().default(true)
      })
      .strict(),
    showWant: z.boolean(),
    // Settings saved before Stage 21 have no choice; they rotate daily. "rotate" and "manual" are
    // the names from before the visit and session modes.
    homeFeatured: z
      .preprocess(
        (value) => (value === "rotate" ? "daily" : value === "manual" ? "fixed" : value),
        z.enum(ROTATION_MODES)
      )
      .default("daily"),
    featuredWall: z
      .object({
        visibleRows: z.number().int().min(1).max(8).default(3),
        targetRowHeight: z.number().int().min(100).max(360).default(180)
      })
      .strict()
      .default({ visibleRows: 3, targetRowHeight: 180 })
  })
  .strict();

export const personIdSchema = projectIdSchema;

export const personIdentitySchema = z
  .object({
    provider: z.enum(["tmdb", "musicbrainz", "spotify", "itunes"]),
    externalId: z.string().trim().min(1).max(100),
    confirmed: z.boolean().default(false)
  })
  .strict()
  .superRefine((v, ctx) => {
    const valid =
      v.provider === "musicbrainz"
        ? /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v.externalId)
        : v.provider === "spotify"
          ? /^[A-Za-z0-9]{22}$/.test(v.externalId)
          : /^\d{1,15}$/.test(v.externalId);
    if (!valid) ctx.addIssue({ code: "custom", message: "来源ID格式无效" });
  });
const personIdentityFields = {
  kind: z.enum(["person", "group", "organization"]),
  aliases: z.array(z.string().trim().min(1).max(120)).max(50),
  identities: z
    .array(personIdentitySchema)
    .max(20)
    .refine(
      (v) => new Set(v.map((i) => `${i.provider}:${i.externalId}`)).size === v.length,
      "重复的来源身份"
    )
};
export const personSearchQuerySchema = z.object({
  source: z.enum(["tmdb", "musicbrainz"]).default("tmdb"),
  q: z.string().trim().min(1, "Enter a name to search").max(100)
});

export const personCreateSchema = z
  .object({
    kind: personIdentityFields.kind.default("person"),
    aliases: personIdentityFields.aliases.default([]),
    name: requiredText(120, "Name is required in at least one language"),
    originalName: clearableString(120).optional()
  })
  .strict();

export const personImportSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("tmdb"), sourceId: z.string().regex(/^\d{1,12}$/) }).strict(),
  z.object({ source: z.literal("musicbrainz"), sourceId: z.string().uuid() }).strict()
]);

/** An https link. */
const httpsLink = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Links must be https URLs");

export const personUpdateSchema = z
  .object({
    ...personIdentityFields,
    members: z
      .array(
        z
          .object({
            personId: z.string().uuid(),
            role: z.string().trim().max(80).nullable(),
            startYear: z.number().int().min(1000).max(3000).nullable(),
            endYear: z.number().int().min(1000).max(3000).nullable()
          })
          .strict()
          .refine(
            (m) => m.startYear === null || m.endYear === null || m.endYear >= m.startYear,
            "成员结束年份不能早于开始年份"
          )
      )
      .max(100)
      .refine((v) => new Set(v.map((m) => m.personId)).size === v.length, "成员重复"),
    name: requiredText(120, "Name is required in at least one language"),
    originalName: clearableString(120),
    bio: localizedText(5000),
    links: z.array(httpsLink).max(10, "At most 10 links"),
    featured: z.boolean(),
    visibility: z.enum(["public", "private"])
  })
  .partial()
  .strict();

const relationRole = z.enum([...PERSON_ROLES, ...SOUNDTRACK_ROLES] as [string, ...string[]]);

export const relationIdSchema = projectIdSchema;

export const relationCreateSchema = z
  .object({
    from: z.object({ type: z.enum(["media", "person"]), id: uuid }).strict(),
    toId: uuid,
    type: z.enum(["soundtrack", "adaptation", "sequel", "related", "credit"]),
    role: relationRole.nullable().default(null),
    note: localizedText(200).default({})
  })
  .strict()
  .superRefine((value, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (value.type === "credit") {
      if (value.from.type !== "person") issue("Credits link a person to an entry");
      if (!value.role || !(PERSON_ROLES as readonly string[]).includes(value.role))
        issue("Credits need a person's role");
      return;
    }
    if (value.from.type !== "media") issue("Only credits start at a person");
    if (value.from.id === value.toId) issue("An entry cannot link to itself");
    if (
      value.type === "soundtrack" &&
      value.role &&
      !(SOUNDTRACK_ROLES as readonly string[]).includes(value.role)
    )
      issue("Invalid soundtrack role");
    if (value.type !== "soundtrack" && value.role)
      issue("Only credits and soundtracks have a role");
  });

export const relationUpdateSchema = z
  .object({ role: relationRole.nullable(), note: localizedText(200) })
  .partial()
  .strict();

// Tech stack (Stage 24). Ids are UUIDs, including the migrated defaults.
export const stackIdSchema = z.object({ id: uuid });

const stackName = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(60, "Names are at most 60 characters")
  .refine(
    (value) => ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    "Names cannot contain control characters"
  );

/** An official website: https or http only; null or "" clears it. */
const stackWebsite = z
  .string()
  .trim()
  .max(2048)
  .nullable()
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      );
    } catch {
      return false;
    }
  }, "Websites must be http(s) links")
  .transform((value) => (value ? new URL(value).href : null));

const stackIcon = z.discriminatedUnion("provider", [
  z
    .object({
      provider: z.enum(["devicon", "simpleicons"]),
      key: z.string().regex(/^[a-z0-9_][a-z0-9_-]{0,80}$/, "Unknown icon")
    })
    .strict(),
  z.object({ provider: z.literal("none") }).strict()
]);

export const stackCategoryCreateSchema = z
  .object({
    name: requiredText(40, "Name is required in at least one language"),
    description: localizedText(200).default({}),
    visible: z.boolean().default(true)
  })
  .strict();

export const stackCategoryUpdateSchema = z
  .object({
    name: requiredText(40, "Name is required in at least one language"),
    description: localizedText(200),
    visible: z.boolean()
  })
  .partial()
  .strict();

/** Query of DELETE: without `technologies` only an empty category can be deleted. */
export const stackCategoryDeleteSchema = z
  .object({ technologies: z.enum(["move", "delete"]).optional(), to: uuid.optional() })
  .strict()
  .refine((value) => value.technologies !== "move" || value.to, "Choose where to move them")
  .refine((value) => value.technologies === "move" || !value.to, "Unexpected target category");

export const stackTechnologyCreateSchema = z
  .object({
    categoryId: uuid,
    name: stackName,
    icon: stackIcon.default({ provider: "none" }),
    websiteUrl: stackWebsite.default(null),
    prominence: z.enum(["primary", "standard"]).default("standard"),
    visible: z.boolean().default(true),
    projectIds: linkIds(MAX_TECHNOLOGY_PROJECTS, "projects").optional()
  })
  .strict();

export const stackTechnologyUpdateSchema = z
  .object({
    categoryId: uuid,
    name: stackName,
    icon: stackIcon,
    websiteUrl: stackWebsite,
    prominence: z.enum(["primary", "standard"]),
    visible: z.boolean(),
    projectIds: linkIds(MAX_TECHNOLOGY_PROJECTS, "projects")
  })
  .partial()
  .strict();

export const stackOrderSchema = z
  .object({
    categories: z
      .array(z.object({ id: uuid, technologies: z.array(uuid).max(500) }).strict())
      .max(100)
  })
  .strict();

export const stackIconSearchSchema = z.object({
  q: z.string().trim().min(1, "Enter a name to search").max(60)
});

const aboutId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");

/** The about section's whole content, as the admin saves it (see AboutContent). */
export const aboutContentSchema = z
  .object({
    manifestos: z
      .array(
        z
          .object({
            id: aboutId,
            text: requiredText(
              ABOUT_LIMITS.manifestoText,
              "A manifesto needs text in at least one language"
            ),
            attribution: localizedText(ABOUT_LIMITS.attribution).default({}),
            weight: z.number().int().min(0).max(10000).default(1),
            visible: z.boolean()
          })
          .strict()
      )
      .max(ABOUT_LIMITS.manifestos, `At most ${ABOUT_LIMITS.manifestos} manifestos`),
    rotation: z
      .object({ mode: z.enum(MANIFESTO_ROTATION_MODES), fixedId: aboutId.nullable() })
      .strict(),
    gear: z
      .array(
        z
          .object({
            id: aboutId,
            name: requiredText(
              ABOUT_LIMITS.gearCategoryName,
              "A gear category needs a name in at least one language"
            ),
            visible: z.boolean(),
            items: z
              .array(
                z
                  .object({
                    id: aboutId,
                    name: z
                      .string()
                      .trim()
                      .min(1, "Gear needs a name")
                      .max(ABOUT_LIMITS.gearItemName),
                    visible: z.boolean()
                  })
                  .strict()
              )
              .max(ABOUT_LIMITS.gearItems, `At most ${ABOUT_LIMITS.gearItems} items per category`)
          })
          .strict()
      )
      .max(ABOUT_LIMITS.gearCategories, `At most ${ABOUT_LIMITS.gearCategories} gear categories`)
  })
  .strict()
  .superRefine((about, ctx) => {
    if (
      about.rotation.mode !== "fixed" &&
      about.manifestos.some((m) => m.visible) &&
      !about.manifestos.some((m) => m.visible && m.weight > 0)
    )
      ctx.addIssue({ code: "custom", message: "至少一条可见宣言的权重必须大于0" });
    const ids = [
      ...about.manifestos.map((m) => m.id),
      ...about.gear.flatMap((c) => [c.id, ...c.items.map((i) => i.id)])
    ];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Duplicate ids" });
    if (about.rotation.fixedId && !about.manifestos.some((m) => m.id === about.rotation.fixedId))
      ctx.addIssue({ code: "custom", message: "The fixed manifesto does not exist" });
    for (const category of about.gear) {
      const names = category.items.map((i) => i.name.toLowerCase());
      const clash = category.items.find((_, i) => names.indexOf(names[i]!) !== i);
      if (clash)
        ctx.addIssue({ code: "custom", message: `“${clash.name}” is already in this category` });
    }
  });

export const aboutUpdateSchema = z
  .object({ about: aboutContentSchema, revision: z.string().max(100) })
  .strict();
