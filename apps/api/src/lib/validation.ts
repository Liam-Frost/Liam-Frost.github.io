import { z } from "zod";

import { badRequest } from "./errors";

export const loginSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required").max(100),
    password: z.string().min(1, "Password is required").max(512)
  })
  .strict();

export const photoParamsSchema = z.object({
  id: z.string().min(1).max(200)
});

export const spotifyQuerySchema = z.object({
  url: z
    .string({ message: "Missing Spotify URL" })
    .trim()
    .min(1, "Missing Spotify URL")
    .max(2048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "open.spotify.com";
      } catch {
        return false;
      }
    }, "Invalid Spotify URL")
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
    .object(Object.fromEntries(LANG_KEYS.map((lang) => [lang, z.string().trim().max(max).optional()])) as Record<(typeof LANG_KEYS)[number], z.ZodOptional<z.ZodString>>)
    .strict()
    .transform((value) => Object.fromEntries(Object.entries(value).filter(([, text]) => text)) as Partial<Record<(typeof LANG_KEYS)[number], string>>);
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
