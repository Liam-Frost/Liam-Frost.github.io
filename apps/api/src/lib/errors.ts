import type { ApiErrorBody } from "@liam-frost/shared";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** Also used for admin routes hidden by ADMIN_ALLOWED_IPS, so they look exactly like unknown routes. */
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);

export const badRequest = (message: string, code = "BAD_REQUEST") => new HttpError(400, code, message);

const DATABASE_UNAVAILABLE_CODES = new Set([
  // Prisma: unreachable, auth failed, timeout, database missing, connection closed, pool timeout.
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1017",
  "P2024",
  // Driver adapter errors carry the socket error code.
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN"
]);

/** True when an error means the database could not be reached, as opposed to a failed query. */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "PrismaClientInitializationError") return true;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && DATABASE_UNAVAILABLE_CODES.has(code);
}
