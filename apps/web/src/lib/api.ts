const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const apiFetchEnabled = import.meta.env.VITE_DISABLE_API_FETCH !== "true";

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${configuredApiBase}${normalizedPath}`;
}
