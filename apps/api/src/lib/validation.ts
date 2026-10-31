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
