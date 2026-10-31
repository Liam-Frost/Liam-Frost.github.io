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
