import exifReader from "exif-reader";

export type ExifSuggestions = {
  camera?: string;
  lens?: string;
  /** Same style as existing photos: "1/100 · f/4 · ISO 800". */
  settings?: string;
  /** YYYY-MM-DD */
  date?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim() || undefined : undefined;
}

function formatExposure(seconds: number) {
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`;
  return `1/${Math.round(1 / seconds)}`;
}

/** Reads camera, lens, exposure and capture date from raw EXIF. Never throws: bad EXIF just yields no suggestions. */
export function readExif(raw: Buffer | undefined): ExifSuggestions {
  if (!raw) return {};
  let exif: ReturnType<typeof exifReader>;
  try {
    exif = exifReader(raw);
  } catch {
    return {};
  }

  const make = clean(exif.Image?.Make);
  const model = clean(exif.Image?.Model);
  const camera =
    model && make && !model.toLowerCase().startsWith(make.toLowerCase().split(" ")[0])
      ? `${make} ${model}`
      : (model ?? make);

  const photo = exif.Photo ?? {};
  const parts: string[] = [];
  if (typeof photo.ExposureTime === "number" && photo.ExposureTime > 0)
    parts.push(formatExposure(photo.ExposureTime));
  if (typeof photo.FNumber === "number" && photo.FNumber > 0)
    parts.push(`f/${Number(photo.FNumber.toFixed(1))}`);
  const iso = Array.isArray(photo.ISOSpeedRatings)
    ? photo.ISOSpeedRatings[0]
    : photo.ISOSpeedRatings;
  if (typeof iso === "number" && iso > 0) parts.push(`ISO ${iso}`);

  const taken = photo.DateTimeOriginal;
  const date =
    taken instanceof Date && !Number.isNaN(taken.getTime())
      ? taken.toISOString().slice(0, 10)
      : undefined;

  return {
    camera,
    lens: clean(photo.LensModel),
    settings: parts.length ? parts.join(" · ") : undefined,
    date
  };
}
