import { readStorageConfig, type ImageStorageDriver } from "./config";

export type ImageReference = {
  driver?: ImageStorageDriver;
  url?: string;
  path?: string;
  key?: string;
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function resolveImageUrl(image: ImageReference) {
  const config = readStorageConfig();
  const driver = image.driver ?? config.driver;

  if (driver === "remote-url") {
    return image.url ?? "";
  }

  if (driver === "local") {
    const path = trimSlashes(image.path ?? "");
    return path ? `${config.localPublicBaseUrl.replace(/\/$/, "")}/${path}` : "";
  }

  const key = trimSlashes(image.key ?? "");
  return key && config.r2PublicBaseUrl ? `${config.r2PublicBaseUrl.replace(/\/$/, "")}/${key}` : "";
}
