import {
  ADMIN_REQUEST_HEADER,
  type AdminPhotoResponse,
  type AdminPhotosResponse,
  type AdminPhotoUpdate,
  type AdminProjectCreate,
  type AdminProjectResponse,
  type AdminProjectsResponse,
  type AdminProjectUpdate,
  type AdminSessionResponse,
  type AdminSpotifyResponse,
  type ApiErrorBody,
  type SpotifySettings
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
    throw apiError(response.status, data as Partial<ApiErrorBody> | undefined);
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
  return apiError(status, data);
}

const DATABASE_UNAVAILABLE_MESSAGE = "数据库连接失败：请确认数据库已启动，并检查 apps/api/.env 中的 DATABASE_URL";

function apiError(status: number, data: Partial<ApiErrorBody> | undefined) {
  const code = data?.error?.code ?? "HTTP";
  // Shown in toasts and inline errors anywhere in the admin, so it is translated here once.
  if (code === "DATABASE_UNAVAILABLE") return new ApiError(status, code, DATABASE_UNAVAILABLE_MESSAGE);
  return new ApiError(status, code, data?.error?.message ?? `请求失败（HTTP ${status}）`);
}

/** Uploads one file with progress (fetch cannot report upload progress). */
function uploadFile<T>(url: string, file: File, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader(ADMIN_REQUEST_HEADER, "1");
    xhr.setRequestHeader("accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as T);
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

export function uploadPhoto(file: File, onProgress: (fraction: number) => void) {
  return uploadFile<AdminPhotoResponse>("/api/admin/photos", file, onProgress);
}

const photoPath = (id: string) => `/api/admin/photos/${encodeURIComponent(id)}`;
const projectPath = (id: string) => `/api/admin/projects/${encodeURIComponent(id)}`;

export const api = {
  session: () => request<AdminSessionResponse>("/api/admin/session"),
  login: (username: string, password: string) =>
    request<AdminSessionResponse>("/api/admin/login", { method: "POST", json: { username, password } }),
  logout: () => request<{ authenticated: false }>("/api/admin/logout", { method: "POST" }),

  photos: () => request<AdminPhotosResponse>("/api/admin/photos"),
  updatePhoto: (id: string, update: AdminPhotoUpdate) => request<AdminPhotoResponse>(photoPath(id), { method: "PATCH", json: update }),
  deletePhoto: (id: string) => request<void>(photoPath(id), { method: "DELETE" }),
  reorderPhotos: (ids: string[]) => request<AdminPhotosResponse>("/api/admin/photos/order", { method: "PUT", json: { ids } }),

  projects: () => request<AdminProjectsResponse>("/api/admin/projects"),
  project: (id: string) => request<AdminProjectResponse>(projectPath(id)),
  createProject: (body: AdminProjectCreate) => request<AdminProjectResponse>("/api/admin/projects", { method: "POST", json: body }),
  updateProject: (id: string, update: AdminProjectUpdate) => request<AdminProjectResponse>(projectPath(id), { method: "PATCH", json: update }),
  deleteProject: (id: string) => request<void>(projectPath(id), { method: "DELETE" }),
  reorderProjects: (ids: string[]) => request<AdminProjectsResponse>("/api/admin/projects/order", { method: "PUT", json: { ids } }),
  uploadProjectImage: (id: string, slot: "cover" | "gallery", file: File, onProgress?: (fraction: number) => void) =>
    uploadFile<AdminProjectResponse>(`${projectPath(id)}/images?slot=${slot}`, file, onProgress),
  deleteProjectImage: (id: string, imageId: string) =>
    request<AdminProjectResponse>(`${projectPath(id)}/images/${encodeURIComponent(imageId)}`, { method: "DELETE" }),

  spotify: () => request<AdminSpotifyResponse>("/api/admin/spotify"),
  updateSpotify: (settings: SpotifySettings) => request<AdminSpotifyResponse>("/api/admin/spotify", { method: "PUT", json: settings }),
  syncSpotify: () => request<AdminSpotifyResponse>("/api/admin/spotify/sync", { method: "POST" })
};
