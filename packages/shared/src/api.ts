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

/** Collection entries: films, series and anime now; music (track/album) in a later stage. */
export type MediaKind = "movie" | "tv" | "anime" | "track" | "album";
/** Watch status for films, series and anime. */
export type MediaStatus = "want" | "watching" | "done" | "dropped";
/** Where an entry's details came from. */
export type MediaSource = "tmdb" | "bangumi" | "spotify" | "itunes" | "manual";

/** Episodes watched out of the total (unknown total: null). */
export type MediaProgress = { watched: number; total: number | null };

export type AdminMediaItem = {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  sourceId: string | null;
  /** The entry on TMDB / Bangumi / ..., when imported. */
  sourceUrl: string | null;
  title: LocalizedText;
  originalTitle: string | null;
  year: number | null;
  genres: LocalizedText[];
  /** Directors, studios, creators. */
  credits: string[];
  overview: LocalizedText;
  poster: ProjectImage | null;
  status: MediaStatus | null;
  /** 1-5; null when not rated. */
  rating: number | null;
  review: LocalizedText;
  /** YYYY-MM-DD */
  watchedOn: string | null;
  rewatchCount: number;
  progress: MediaProgress | null;
  featured: boolean;
  visibility: PhotoVisibility;
  createdAt: string;
  updatedAt: string;
};

/** Manual entry without a source. */
export type AdminMediaCreate = { kind: MediaKind; title: LocalizedText };
/** Import from a source search result. */
export type AdminMediaImport = { kind: MediaKind; source: "tmdb" | "bangumi"; sourceId: string };

/** Editable fields; `null` clears an optional field. */
export type AdminMediaUpdate = Partial<{
  title: LocalizedText;
  originalTitle: string | null;
  year: number | null;
  genres: LocalizedText[];
  credits: string[];
  overview: LocalizedText;
  status: MediaStatus;
  rating: number | null;
  review: LocalizedText;
  watchedOn: string | null;
  rewatchCount: number;
  progress: MediaProgress | null;
  featured: boolean;
  visibility: PhotoVisibility;
}>;

export type MediaSearchResult = {
  source: "tmdb" | "bangumi";
  sourceId: string;
  /** Movie or series, for TMDB anime searches. */
  mediaType: "movie" | "tv";
  title: string;
  originalTitle: string | null;
  year: number | null;
  /** Small remote poster for the result list; imports download their own copy. */
  posterUrl: string | null;
  overview: string;
  /** Already in the collection. */
  existingId: string | null;
};

export type CollectionSettings = {
  /** Which kinds the site shows. */
  show: { movie: boolean; tv: boolean; anime: boolean; music: boolean };
  /** Off: "want" entries never appear on the site, whatever their own visibility. */
  showWant: boolean;
};

export type AdminMediaListResponse = { items: AdminMediaItem[] };
export type AdminMediaResponse = { item: AdminMediaItem };
export type AdminMediaSearchResponse = { results: MediaSearchResult[] };
export type AdminCollectionSettingsResponse = {
  settings: CollectionSettings;
  /** Sources that can be searched (TMDB needs TMDB_API_KEY). */
  sources: { tmdb: boolean; bangumi: boolean };
};

/** A collection entry in the public list (no synopsis or review). */
export type PublicMediaSummary = {
  id: string;
  kind: MediaKind;
  title: LocalizedText;
  originalTitle: string | null;
  year: number | null;
  genres: LocalizedText[];
  credits: string[];
  poster: ProjectImage | null;
  status: MediaStatus | null;
  rating: number | null;
  watchedOn: string | null;
  rewatchCount: number;
  progress: MediaProgress | null;
  featured: boolean;
  /** Whether a short review exists in any language. */
  hasReview: boolean;
  updatedAt: string;
};

/** One entry with its synopsis and review, for the detail view. */
export type PublicMedia = PublicMediaSummary & {
  overview: LocalizedText;
  review: LocalizedText;
  source: MediaSource;
  sourceUrl: string | null;
};

export type PublicCollection = {
  /** Kinds the site shows, in display order. */
  kinds: MediaKind[];
  items: PublicMediaSummary[];
};
