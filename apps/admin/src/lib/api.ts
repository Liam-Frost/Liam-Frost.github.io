import {
  ADMIN_REQUEST_HEADER,
  type AdminCollectionSettingsResponse,
  type AdminMediaCreate,
  type AdminMediaImport,
  type AdminMediaListResponse,
  type AdminMediaResponse,
  type AdminMediaSearchResponse,
  type AdminMediaUpdate,
  type AdminMusicImport,
  type AdminMusicSearchResponse,
  type AdminPeopleResponse,
  type AdminPersonCreate,
  type AdminPersonResponse,
  type AdminPersonSearchResponse,
  type AdminPersonUpdate,
  type AdminRelationCreate,
  type AdminRelationResponse,
  type AdminRelationsResponse,
  type AdminRelationSuggestionsResponse,
  type AdminRelationUpdate,
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
  type CollectionSettings,
  type MediaKind,
  type MusicImportJob,
  type MusicImportRequest,
  type SpotifyAccountStatus,
  type SpotifyOwnPlaylist,
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
const mediaPath = (id: string) => `/api/admin/media/${encodeURIComponent(id)}`;
const personPath = (id: string) => `/api/admin/people/${encodeURIComponent(id)}`;
const relationPath = (id: string) => `/api/admin/relations/${encodeURIComponent(id)}`;

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

  media: () => request<AdminMediaListResponse>("/api/admin/media"),
  mediaItem: (id: string) => request<AdminMediaResponse>(mediaPath(id)),
  searchMedia: (kind: MediaKind, source: "tmdb" | "bangumi", q: string) =>
    request<AdminMediaSearchResponse>(`/api/admin/media/search?${new URLSearchParams({ kind, source, q })}`),
  importMedia: (body: AdminMediaImport) => request<AdminMediaResponse>("/api/admin/media/import", { method: "POST", json: body }),
  createMedia: (body: AdminMediaCreate) => request<AdminMediaResponse>("/api/admin/media", { method: "POST", json: body }),
  updateMedia: (id: string, update: AdminMediaUpdate) => request<AdminMediaResponse>(mediaPath(id), { method: "PATCH", json: update }),
  deleteMedia: (id: string) => request<void>(mediaPath(id), { method: "DELETE" }),
  uploadMediaPoster: (id: string, file: File) => uploadFile<AdminMediaResponse>(`${mediaPath(id)}/poster`, file),
  searchMusic: (q: string, country: string) => request<AdminMusicSearchResponse>(`/api/admin/music/search?${new URLSearchParams({ q, country })}`),
  importMusic: (body: AdminMusicImport) => request<AdminMediaResponse>("/api/admin/music/import", { method: "POST", json: body }),
  startPlaylistImport: (playlistUrl: string) => request<{ job: MusicImportJob }>("/api/admin/music/playlist-import", { method: "POST", json: { playlistUrl } }),
  startSpotifyImport: (body: MusicImportRequest) => request<{ job: MusicImportJob }>("/api/admin/music/spotify-import", { method: "POST", json: body }),
  spotifyAccount: () => request<SpotifyAccountStatus>("/api/admin/spotify/account"),
  connectSpotify: (returnTo: string) => request<{ url: string }>("/api/admin/spotify/connect", { method: "POST", json: { returnTo } }),
  disconnectSpotify: () => request<void>("/api/admin/spotify/account", { method: "DELETE" }),
  spotifyPlaylists: () => request<{ playlists: SpotifyOwnPlaylist[] }>("/api/admin/spotify/playlists"),
  musicJob: (id: string) => request<{ job: MusicImportJob }>(`/api/admin/music/jobs/${encodeURIComponent(id)}`),
  people: () => request<AdminPeopleResponse>("/api/admin/people"),
  person: (id: string) => request<AdminPersonResponse>(personPath(id)),
  searchPeople: (q: string) => request<AdminPersonSearchResponse>(`/api/admin/people/search?${new URLSearchParams({ q })}`),
  importPerson: (sourceId: string) => request<AdminPersonResponse>("/api/admin/people/import", { method: "POST", json: { source: "tmdb", sourceId } }),
  createPerson: (body: AdminPersonCreate) => request<AdminPersonResponse>("/api/admin/people", { method: "POST", json: body }),
  updatePerson: (id: string, update: AdminPersonUpdate) => request<AdminPersonResponse>(personPath(id), { method: "PATCH", json: update }),
  deletePerson: (id: string) => request<void>(personPath(id), { method: "DELETE" }),
  uploadPersonPhoto: (id: string, file: File) => uploadFile<AdminPersonResponse>(`${personPath(id)}/photo`, file),
  relations: (subject: { type: "media" | "person"; id: string }) =>
    request<AdminRelationsResponse>(`${subject.type === "media" ? mediaPath(subject.id) : personPath(subject.id)}/relations`),
  suggestions: (mediaId: string) => request<AdminRelationSuggestionsResponse>(`${mediaPath(mediaId)}/suggestions`),
  createRelation: (body: AdminRelationCreate) => request<AdminRelationResponse>("/api/admin/relations", { method: "POST", json: body }),
  updateRelation: (id: string, update: AdminRelationUpdate) => request<AdminRelationResponse>(relationPath(id), { method: "PATCH", json: update }),
  deleteRelation: (id: string) => request<void>(relationPath(id), { method: "DELETE" }),
  collectionSettings: () => request<AdminCollectionSettingsResponse>("/api/admin/collection/settings"),
  updateCollectionSettings: (settings: CollectionSettings) =>
    request<AdminCollectionSettingsResponse>("/api/admin/collection/settings", { method: "PUT", json: settings })
};
