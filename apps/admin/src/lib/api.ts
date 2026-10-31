import { ADMIN_REQUEST_HEADER, type AdminSessionResponse, type ApiErrorBody } from "@liam-frost/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

export async function request<T>(path: string, { json, headers: initHeaders, ...init }: RequestOptions = {}): Promise<T> {
  const headers = new Headers(initHeaders);
  headers.set("accept", "application/json");
  // CSRF: the API rejects admin writes without this header.
  if (init.method && init.method !== "GET") headers.set(ADMIN_REQUEST_HEADER, "1");

  let body = init.body;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "NETWORK", "无法连接服务器，请检查网络");
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const error = (data as Partial<ApiErrorBody> | undefined)?.error;
    throw new ApiError(response.status, error?.code ?? "HTTP", error?.message ?? `请求失败（HTTP ${response.status}）`);
  }
  return data as T;
}

export const api = {
  session: () => request<AdminSessionResponse>("/api/admin/session"),
  login: (username: string, password: string) =>
    request<AdminSessionResponse>("/api/admin/login", { method: "POST", json: { username, password } }),
  logout: () => request<{ authenticated: false }>("/api/admin/logout", { method: "POST" })
};
