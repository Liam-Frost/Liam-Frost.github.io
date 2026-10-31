import {
  ADMIN_REQUEST_HEADER,
  type AdminPhotoResponse,
  type AdminPhotosResponse,
  type AdminPhotoUpdate,
  type AdminSessionResponse,
  type ApiErrorBody
} from "@liam-frost/shared";

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

function toApiError(status: number, body: string) {
  let data: Partial<ApiErrorBody> | undefined;
  try {
    data = body ? JSON.parse(body) : undefined;
  } catch {
    data = undefined;
  }
  return new ApiError(status, data?.error?.code ?? "HTTP", data?.error?.message ?? `请求失败（HTTP ${status}）`);
}

/** Uploads one file with progress (fetch cannot report upload progress). */
export function uploadPhoto(file: File, onProgress: (fraction: number) => void): Promise<AdminPhotoResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/photos");
    xhr.setRequestHeader(ADMIN_REQUEST_HEADER, "1");
    xhr.setRequestHeader("accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as AdminPhotoResponse);
      } else {
        reject(toApiError(xhr.status, xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "无法连接服务器，请检查网络"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

const photoPath = (id: string) => `/api/admin/photos/${encodeURIComponent(id)}`;

export const api = {
  session: () => request<AdminSessionResponse>("/api/admin/session"),
  login: (username: string, password: string) =>
    request<AdminSessionResponse>("/api/admin/login", { method: "POST", json: { username, password } }),
  logout: () => request<{ authenticated: false }>("/api/admin/logout", { method: "POST" }),

  photos: () => request<AdminPhotosResponse>("/api/admin/photos"),
  updatePhoto: (id: string, update: AdminPhotoUpdate) => request<AdminPhotoResponse>(photoPath(id), { method: "PATCH", json: update }),
  deletePhoto: (id: string) => request<void>(photoPath(id), { method: "DELETE" }),
  reorderPhotos: (ids: string[]) => request<AdminPhotosResponse>("/api/admin/photos/order", { method: "PUT", json: { ids } })
};
