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

export type ProjectStatus = "in-progress" | "completed" | "archived";

export type ProjectLinks = {
  repo?: string;
  demo?: string;
  docs?: string;
};

/** An uploaded project image with its generated sizes (smallest first). */
export type ProjectImage = {
  id: string;
  width: number;
  height: number;
  /** Largest size. */
  src: string;
  variants: PhotoVariantInfo[];
};

/** Project fields shown in lists (home page, /projects). */
export type PublicProjectSummary = {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  cover: ProjectImage | null;
  techStack: string[];
  links: ProjectLinks;
  status: ProjectStatus;
  startedAt: string | null;
  endedAt: string | null;
  featured: boolean;
};

/** A project's detail page. */
export type PublicProject = PublicProjectSummary & {
  /** Markdown per language. */
  body: LocalizedText;
  gallery: ProjectImage[];
};

export type AdminProject = PublicProject & {
  id: string;
  visibility: PhotoVisibility;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminProjectCreate = { title: LocalizedText; slug: string };

/** Editable fields; `null` clears an optional field. `gallery` is the new order of existing image ids. */
export type AdminProjectUpdate = Partial<{
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  body: LocalizedText;
  techStack: string[];
  links: ProjectLinks;
  status: ProjectStatus;
  startedAt: string | null;
  endedAt: string | null;
  featured: boolean;
  visibility: PhotoVisibility;
  gallery: string[];
}>;

export type AdminProjectsResponse = { projects: AdminProject[] };
export type AdminProjectResponse = { project: AdminProject };

/** Spotify player settings, edited in the admin. */
export type SpotifySettings = {
  enabled: boolean;
  /** https://open.spotify.com/playlist/<id> */
  playlistUrl: string;
  shuffle: boolean;
  /** Initial preview volume, 0-100. */
  volume: number;
  /** Seconds before the player collapses after the page loads; 0 keeps it open. */
  autoCollapseSeconds: number;
};

/** A playlist track with its 30-second preview. */
export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  image: string;
  /** The track on open.spotify.com. */
  link: string;
  previewUrl: string;
};

export type SpotifyPlaylistInfo = { id: string; name: string; image: string; link: string };

/** What the site's player needs. */
export type PublicSpotifyPlayer = Omit<SpotifySettings, "playlistUrl"> & {
  playlist: SpotifyPlaylistInfo | null;
  tracks: SpotifyTrack[];
};

export type SpotifySyncStatus = {
  /** Last successful sync of the configured playlist. */
  syncedAt: string | null;
  /** Last attempt, successful or not. */
  attemptedAt: string | null;
  /** Why the last attempt failed; null after a success. */
  error: string | null;
  playlist: SpotifyPlaylistInfo | null;
  tracks: SpotifyTrack[];
};

export type AdminSpotifyResponse = { settings: SpotifySettings; sync: SpotifySyncStatus };
