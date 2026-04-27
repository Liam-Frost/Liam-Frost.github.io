export type ImageStorageDriver = "remote-url" | "local" | "r2";

export type ImageStorageConfig = {
  driver: ImageStorageDriver;
  localPublicBaseUrl: string;
  r2PublicBaseUrl: string;
};

const supportedDrivers = new Set<ImageStorageDriver>(["remote-url", "local", "r2"]);

export function readStorageConfig(env = process.env): ImageStorageConfig {
  const requestedDriver = env.IMAGE_STORAGE_DRIVER ?? "remote-url";
  const driver = supportedDrivers.has(requestedDriver as ImageStorageDriver)
    ? (requestedDriver as ImageStorageDriver)
    : "remote-url";

  return {
    driver,
    localPublicBaseUrl: env.LOCAL_UPLOAD_PUBLIC_BASE_URL ?? "/uploads",
    r2PublicBaseUrl: env.R2_PUBLIC_BASE_URL ?? ""
  };
}
