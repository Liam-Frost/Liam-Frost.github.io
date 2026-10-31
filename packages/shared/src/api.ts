/** Header every admin write request must carry; cross-site forms cannot set it (CSRF defense). */
export const ADMIN_REQUEST_HEADER = "x-admin-request";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type AdminUser = {
  username: string;
};

export type AdminSessionResponse = {
  authenticated: boolean;
  configured: boolean;
  user: AdminUser | null;
  /** Only returned to an authenticated admin. */
  adminPath?: string;
};

/** Languages the site content is written in. */
export const LANGS = ["zh", "zh-Hant", "en", "fr", "ja"] as const;
export type Lang = (typeof LANGS)[number];

/** Text in several languages; missing languages fall back on the public site. */
export type LocalizedText = Partial<Record<Lang, string>>;

export type PhotoVisibility = "public" | "private";

export type PhotoVariantInfo = {
  width: number;
  height: number;
  url: string;
};

/** A photo as the admin API returns it (includes hidden photos and management fields). */
export type AdminPhoto = {
  id: string;
  title: LocalizedText;
  date: string;
  category: LocalizedText;
  location: LocalizedText | null;
  camera: string | null;
  lens: string | null;
  settings: string | null;
  description: LocalizedText | null;
  tags: LocalizedText[];
  alt: LocalizedText;
  width: number;
  height: number;
  /** Largest available image. */
  src: string;
  /** Small image for lists. */
  thumbnail: string;
  storage: "remote-url" | "local";
  variants: PhotoVariantInfo[];
  visibility: PhotoVisibility;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Editable fields; `null` clears an optional field. */
export type AdminPhotoUpdate = Partial<{
  title: LocalizedText;
  date: string;
  category: LocalizedText;
  location: LocalizedText | null;
  camera: string | null;
  lens: string | null;
  settings: string | null;
  description: LocalizedText | null;
  tags: LocalizedText[];
  alt: LocalizedText;
  visibility: PhotoVisibility;
  featured: boolean;
}>;

export type AdminPhotosResponse = { photos: AdminPhoto[] };
export type AdminPhotoResponse = { photo: AdminPhoto };
