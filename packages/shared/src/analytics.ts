/**
 * Visitor analytics: what the site sends and what the admin reads. No cookies and nothing identifying is
 * kept in the browser; the server counts visitors per day with a hash that changes every day.
 */

export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "content_view",
  "music_play",
  "outbound_click",
  "collection_filter",
  "engagement",
  "web_vital"
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Pages are counted by their route, not their address ("*" is the not-found page). */
export const ANALYTICS_PATHS = [
  "/",
  "/portfolio",
  "/projects",
  "/projects/:slug",
  "/collection",
  "/privacy",
  "*"
] as const;
export type AnalyticsPath = (typeof ANALYTICS_PATHS)[number];

export const ANALYTICS_CONTENT_TYPES = ["project", "photo", "media", "person", "playlist"] as const;
export type AnalyticsContentType = (typeof ANALYTICS_CONTENT_TYPES)[number];

/** Which player played a song, and what started it: a song's button, 播放全部, or the corner player itself. */
export const ANALYTICS_PLAYERS = ["site", "spotify"] as const;
export const ANALYTICS_PLAY_SOURCES = ["button", "all", "dock"] as const;

/** Core Web Vitals sent by the site: largest paint and interaction delay in ms, layout shift × 1000. */
export const ANALYTICS_VITALS = ["lcp", "inp", "cls"] as const;
export type AnalyticsVital = (typeof ANALYTICS_VITALS)[number];
/** Google's "good" and "poor" limits, in the units above. */
export const VITAL_THRESHOLDS: Record<AnalyticsVital, { good: number; poor: number }> = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 100, poor: 250 }
};

/** One event as the site sends it; the server adds the time, the day's visitor hash and the session's details. */
export type AnalyticsEventInput = {
  /** Random id; sending the same event twice stores it once. */
  id: string;
  type: AnalyticsEventType;
  /** Random id kept in sessionStorage; a new one after 30 minutes without activity. */
  sessionId: string;
  path: AnalyticsPath;
  contentType?: AnalyticsContentType;
  contentId?: string;
  /** music_play: player; outbound_click: the link's host; collection_filter: the tab; web_vital: the metric. */
  target?: string;
  /** music_play: what started it; outbound_click: where the link was; collection_filter: the view. */
  detail?: string;
  /** engagement: seconds the page was visible; web_vital: the measurement. */
  value?: number;
  /** page_view: the site language. */
  lang?: string;
  /** First page_view of a session: document.referrer and UTM parameters. */
  referrer?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
};

export type AnalyticsEventBatch = { events: AnalyticsEventInput[] };

export const ANALYTICS_RANGES = ["today", "7d", "30d", "90d", "custom"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type AnalyticsMeta = {
  enabled: boolean;
  timezone: string;
  retentionDays: number;
  minGroupSize: number;
  /** Where countries come from: a proxy's header, a local GeoLite2 database, or nowhere. */
  countrySource: "header" | "geoip" | "none";
  /** Filled by the demo data script; the admin says so. */
  demo: boolean;
  /** The oldest day with data, if any. */
  firstDay: string | null;
};

export type AnalyticsKpis = {
  views: number;
  /** Sum of each day's distinct visitors (one person on two days counts twice). */
  visitors: number;
  sessions: number;
  /** Visible seconds per session. */
  avgEngagedSeconds: number;
  /** Sessions with one page and under 10 visible seconds, as a share of sessions (0-1). */
  bounceRate: number;
};

export type AnalyticsTrendPoint = {
  key: string;
  views: number;
  visitors: number;
  sessions: number;
};

export type AnalyticsRangeInfo = {
  range: AnalyticsRange;
  from: string;
  to: string;
  /** The period compared against: the same length right before. */
  previousFrom: string;
  previousTo: string;
  timezone: string;
};

export type AnalyticsOverview = {
  range: AnalyticsRangeInfo;
  current: AnalyticsKpis;
  previous: AnalyticsKpis;
  /** Hours for a single day, days otherwise. */
  trend: { bucket: "hour" | "day"; points: AnalyticsTrendPoint[] };
  topPages: { path: string; views: number; avgEngagedSeconds: number }[];
  /** Sessions active in the last five minutes. */
  online: number;
};

/** A count by key, e.g. sessions by country. */
export type AnalyticsCount = { key: string; value: number };

/** A collection entry, project, photo, person or playlist, with its name now or when last seen. */
export type AnalyticsContentItem = {
  type: AnalyticsContentType;
  id: string;
  name: string | null;
  /** Collection entries: movie, track, ... */
  kind: string | null;
  /** Hidden or deleted since; shown with the name it had. */
  removed: boolean;
  views: number;
  /** Each day's distinct visitors added up. */
  visitors: number;
  plays: number;
};

export type AnalyticsContentReport = {
  range: AnalyticsRangeInfo;
  items: AnalyticsContentItem[];
  /** Plays by player (site / spotify) and by what started them (button / all / dock). */
  players: AnalyticsCount[];
  playSources: AnalyticsCount[];
  /** Clicks on links to other sites, by host and by where the link was. */
  outbound: AnalyticsCount[];
  outboundPositions: AnalyticsCount[];
  /** Collection tabs and views switched to ("movie", "track:albums", "tv:list"). */
  filters: AnalyticsCount[];
};

export type AnalyticsContentDetail = {
  range: AnalyticsRangeInfo;
  item: AnalyticsContentItem;
  previous: { views: number; visitors: number; plays: number };
  trend: { key: string; views: number; visitors: number; plays: number }[];
  /** Where the visits that opened it came from; only days still within the retention period. */
  referrers: AnalyticsCount[];
};

/** Recent views and plays per id of one content type, for lists and editors. */
export type AnalyticsContentCounts = Record<string, { views: number; plays: number }>;

export type AnalyticsReferrer = AnalyticsCount & {
  group: "search" | "social" | "code" | "direct" | "other";
};

export type AnalyticsAudience = {
  range: AnalyticsRangeInfo;
  sessions: number;
  /** Groups smaller than this are folded into "other" (key ""). */
  minGroupSize: number;
  referrers: AnalyticsReferrer[];
  referrerGroups: AnalyticsCount[];
  utmSources: AnalyticsCount[];
  utmMediums: AnalyticsCount[];
  utmCampaigns: AnalyticsCount[];
  countries: AnalyticsCount[];
  langs: AnalyticsCount[];
  devices: AnalyticsCount[];
  browsers: AnalyticsCount[];
  entries: AnalyticsCount[];
  /** Page views by weekday (0 = Sunday) and hour; null where too few visitors to show. */
  heatmap: { weekday: number; hour: number; views: number | null }[];
};

export type AnalyticsVitalSummary = {
  path: string;
  metric: AnalyticsVital;
  samples: number;
  /** 75th percentile, in the metric's unit (ms, or layout shift × 1000). */
  p75: number;
  rating: "good" | "needs-improvement" | "poor";
};

export type AnalyticsRouteHealth = {
  route: string;
  requests: number;
  serverErrors: number;
  clientErrors: number;
  avgMs: number;
  p95Ms: number;
};

export type AnalyticsSystemEvent = {
  at: string;
  kind: "job" | "source";
  name: string;
  ok: boolean;
  message: string | null;
};

export type AnalyticsSourceStatus = {
  name: string;
  lastOk: string | null;
  lastError: string | null;
  lastErrorMessage: string | null;
};

export type AnalyticsHealth = {
  range: AnalyticsRangeInfo;
  vitals: AnalyticsVitalSummary[];
  routes: AnalyticsRouteHealth[];
  /** Import and sync jobs, newest first. */
  jobs: AnalyticsSystemEvent[];
  /** External sources (TMDB, IGDB, Spotify, ...): last success and last failure. */
  sources: AnalyticsSourceStatus[];
};

export const ANALYTICS_EXPORTS = [
  "pages",
  "trend",
  "content",
  "referrers",
  "countries",
  "health"
] as const;
export type AnalyticsExport = (typeof ANALYTICS_EXPORTS)[number];

export const ANALYTICS_CLEAR_SCOPES = ["events", "health", "all"] as const;
export type AnalyticsClearScope = (typeof ANALYTICS_CLEAR_SCOPES)[number];
