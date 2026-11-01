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
/**
 * Settings of the site's music player. "custom": the site's own card playing the collection's songs marked
 * "in player" (30-second previews). "embed": Spotify's embedded player for `embedUrl` (full songs for
 * visitors signed in to Spotify in that browser, previews otherwise).
 */
export type SpotifySettings = {
  enabled: boolean;
  mode: "custom" | "embed";
  /** https://open.spotify.com/{playlist|album|track|artist}/<id>, for the embed mode. */
  embedUrl: string;
  shuffle: boolean;
  /** Initial preview volume, 0-100. */
  volume: number;
  /** Seconds before the player collapses after the page loads; 0 keeps it open. */
  autoCollapseSeconds: number;
};

/** A song in the site's player, with its 30-second preview. */
export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  image: string;
  /** The song on Spotify (or Apple Music). */
  link: string;
  previewUrl: string;
};

/** What the site's player needs. */
export type PublicSpotifyPlayer = SpotifySettings & { tracks: SpotifyTrack[] };

export type AdminSpotifyResponse = {
  settings: SpotifySettings;
  /** Songs the player plays: in the player, public and with a preview. */
  playerTracks: number;
};

/** Collection entries: films, series, anime, books, comics, games and music (track; album is reserved). */
export type MediaKind = "movie" | "tv" | "anime" | "book" | "comic" | "game" | "track" | "album";
/** Status: watched for films, series and anime, read for books and comics, played for games. */
export type MediaStatus = "want" | "watching" | "done" | "dropped";
/** Where an entry's details came from. */
export type MediaSource = "tmdb" | "bangumi" | "openlibrary" | "googlebooks" | "anilist" | "igdb" | "spotify" | "itunes" | "manual";
/** Sources the admin can search for films, series, anime, books and comics. */
export type MediaSearchSource = "tmdb" | "bangumi" | "openlibrary" | "googlebooks" | "anilist" | "igdb";

/** Book and comic details (kinds "book" and "comic"). */
export type MediaPublication = {
  publisher: string | null;
  /** Books. */
  pages: number | null;
  /** Comics (and book series). */
  volumes: number | null;
  /** Comics: still being published; null when unknown. */
  ongoing: boolean | null;
};

/** Game details (kind "game"). */
export type MediaGame = {
  platforms: string[];
  publishers: string[];
  /** Hours played; null when not recorded. */
  playtimeHours: number | null;
};

/** Song details (kind "track"). */
export type MediaMusic = {
  album: string | null;
  durationMs: number | null;
  /** 30-second preview (iTunes or Spotify CDN). */
  previewUrl: string | null;
  spotifyUrl: string | null;
  appleUrl: string | null;
};

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
  /** Songs only. */
  music: MediaMusic | null;
  /** Books and comics only. */
  publication: MediaPublication | null;
  /** Games only. */
  game: MediaGame | null;
  /** Songs: plays in the site's player. */
  inPlayer: boolean;
  featured: boolean;
  visibility: PhotoVisibility;
  createdAt: string;
  updatedAt: string;
};

/** Manual entry without a source. */
export type AdminMediaCreate = { kind: MediaKind; title: LocalizedText };
/** Import from a source search result. */
export type AdminMediaImport = { kind: MediaKind; source: MediaSearchSource; sourceId: string };

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
  /** Songs: album, and a preview chosen from an iTunes search result. */
  music: { album?: string | null; previewUrl?: string | null; appleUrl?: string | null };
  /** Books and comics. */
  publication: Partial<MediaPublication>;
  /** Games. */
  game: Partial<MediaGame>;
  inPlayer: boolean;
  featured: boolean;
  visibility: PhotoVisibility;
}>;

export type MediaSearchResult = {
  source: MediaSearchSource;
  sourceId: string;
  /** Movie or series, for TMDB anime searches; null for books and comics. */
  mediaType: "movie" | "tv" | null;
  /** Authors of books and comics. */
  creators: string[];
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
  /** Which kinds the site shows (people: the people tab and people in entries' links). */
  show: { movie: boolean; tv: boolean; anime: boolean; book: boolean; comic: boolean; game: boolean; music: boolean; people: boolean };
  /** Off: "want" entries never appear on the site, whatever their own visibility. */
  showWant: boolean;
};

/** A song from the iTunes search, for adding to the collection or as a preview source. */
export type MusicSearchResult = {
  itunesId: string;
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  /** Small remote cover for the result list. */
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  appleUrl: string | null;
  existingId: string | null;
};

export type AdminMusicSearchResponse = { results: MusicSearchResult[] };
export type AdminMusicImport = { itunesId: string; country: string };

/** The admin's Spotify account, for importing Liked Songs and own playlists. */
export type SpotifyAccountStatus = {
  /** SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are set. */
  configured: boolean;
  /** The redirect URI to register in the Spotify app. */
  redirectUri: string | null;
  account: { id: string; displayName: string; connectedAt: string } | null;
};

export type SpotifyOwnPlaylist = { id: string; name: string; tracks: number; image: string | null; owner: string };

/** What a music import reads: a public playlist link, the admin's Liked Songs, or one of their playlists. */
export type MusicImportRequest = { source: "liked" } | { source: "playlist"; playlistId: string };

/** Progress of a music import running on the server. */
export type MusicImportJob = {
  id: string;
  source: "playlist-link" | "liked" | "playlist";
  state: "running" | "done" | "failed";
  playlistName: string | null;
  total: number;
  processed: number;
  added: number;
  /** Already in the collection. */
  skipped: number;
  /** Added without a preview (not in the player). */
  noPreview: number;
  error: string | null;
};

export type AdminMediaListResponse = { items: AdminMediaItem[] };
export type AdminMediaResponse = { item: AdminMediaItem };
export type AdminMediaSearchResponse = { results: MediaSearchResult[] };
export type AdminCollectionSettingsResponse = {
  settings: CollectionSettings;
  /** Sources that can be searched (TMDB needs TMDB_API_KEY, Google Books GOOGLE_BOOKS_API_KEY, IGDB the Twitch app). */
  sources: Record<MediaSearchSource, boolean>;
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
  music: MediaMusic | null;
  publication: MediaPublication | null;
  game: MediaGame | null;
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
  /** Linked entries and people the site shows. */
  links: PublicLink[];
};

export type PublicCollection = {
  /** Kinds the site shows, in display order. */
  kinds: MediaKind[];
  items: PublicMediaSummary[];
  /** People the site shows (empty when the people switch is off). */
  people: PublicPersonSummary[];
};

/** How two entries, or a person and an entry, are linked. */
export type RelationType = "soundtrack" | "adaptation" | "sequel" | "related" | "credit";
/** A person's role in a work. */
export type PersonRole =
  | "director"
  | "screenwriter"
  | "creator"
  | "producer"
  | "actor"
  | "voice"
  | "singer"
  | "composer"
  | "lyricist"
  | "author"
  | "illustrator"
  | "studio"
  | "other";
/** What a song is to a work. */
export type SoundtrackRole = "opening" | "ending" | "insert" | "theme" | "score";

export const PERSON_ROLES: readonly PersonRole[] = [
  "director",
  "screenwriter",
  "creator",
  "producer",
  "actor",
  "voice",
  "singer",
  "composer",
  "lyricist",
  "author",
  "illustrator",
  "studio",
  "other"
];
export const SOUNDTRACK_ROLES: readonly SoundtrackRole[] = ["opening", "ending", "insert", "theme", "score"];

/** Where a person's details came from. */
export type PersonSource = "tmdb" | "manual";

export type AdminPerson = {
  id: string;
  source: PersonSource;
  sourceId: string | null;
  sourceUrl: string | null;
  name: LocalizedText;
  originalName: string | null;
  photo: ProjectImage | null;
  bio: LocalizedText;
  /** https links: official site, Wikipedia, Spotify, ... */
  links: string[];
  featured: boolean;
  visibility: PhotoVisibility;
  /** Entries linked to this person. */
  works: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminPersonCreate = { name: LocalizedText; originalName?: string | null };
export type AdminPersonImport = { source: "tmdb"; sourceId: string };
export type AdminPersonUpdate = Partial<{
  name: LocalizedText;
  originalName: string | null;
  bio: LocalizedText;
  links: string[];
  featured: boolean;
  visibility: PhotoVisibility;
}>;

export type PersonSearchResult = {
  source: "tmdb";
  sourceId: string;
  name: string;
  /** e.g. "Directing", "Acting". */
  department: string | null;
  /** A few titles the person is known for. */
  knownFor: string[];
  photoUrl: string | null;
  existingId: string | null;
};

export type AdminPeopleResponse = { people: AdminPerson[] };
export type AdminPersonResponse = { person: AdminPerson };
export type AdminPersonSearchResponse = { results: PersonSearchResult[] };

/** The other end of a relation in the admin. */
export type AdminRelationEnd =
  | { type: "media"; id: string; kind: MediaKind; title: LocalizedText; year: number | null; poster: ProjectImage | null; visibility: PhotoVisibility }
  | { type: "person"; id: string; name: LocalizedText; photo: ProjectImage | null; visibility: PhotoVisibility };

export type AdminRelation = {
  id: string;
  type: RelationType;
  role: string | null;
  note: LocalizedText;
  /** "from": the entry or person the list is about is where the relation starts. */
  direction: "from" | "to";
  other: AdminRelationEnd;
};

export type AdminRelationCreate = {
  from: { type: "media" | "person"; id: string };
  toId: string;
  type: RelationType;
  role?: string | null;
  note?: LocalizedText;
};
export type AdminRelationUpdate = { role?: string | null; note?: LocalizedText };
export type AdminRelationsResponse = { relations: AdminRelation[] };
export type AdminRelationResponse = { relation: AdminRelation };

/** A link the admin may want to add, found from the entry's source data. */
export type RelationSuggestion =
  /** A cast or crew member on TMDB; importing the person comes first when they are not in the collection. */
  | { kind: "tmdb-person"; sourceId: string; name: string; role: PersonRole; character: string | null; photoUrl: string | null; personId: string | null }
  /** A song's singer or a book's author by name; a person is created when none matches. */
  | { kind: "name"; name: string; role: PersonRole; personId: string | null }
  /** Another entry in the collection that AniList links to this one. */
  | { kind: "media"; relation: AdminRelationCreate; other: Extract<AdminRelationEnd, { type: "media" }> };

export type AdminRelationSuggestionsResponse = { suggestions: RelationSuggestion[] };

/** A person in public lists and links. */
export type PublicPersonSummary = {
  id: string;
  name: LocalizedText;
  originalName: string | null;
  photo: ProjectImage | null;
  /** Roles in the entries the site shows, most common first. */
  roles: PersonRole[];
  /** Entries the site shows. */
  works: number;
  featured: boolean;
};

export type PublicLink = {
  id: string;
  type: RelationType;
  role: string | null;
  note: LocalizedText;
  direction: "from" | "to";
  other: { type: "media"; item: PublicMediaSummary } | { type: "person"; person: PublicPersonSummary };
};

/** One person with their entries, for the person view. */
export type PublicPerson = PublicPersonSummary & {
  bio: LocalizedText;
  links: string[];
  sourceUrl: string | null;
  credits: { id: string; role: string | null; note: LocalizedText; item: PublicMediaSummary }[];
};
