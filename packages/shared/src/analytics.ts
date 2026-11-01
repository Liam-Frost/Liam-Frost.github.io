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
  "engagement"
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
  /** music_play: player; outbound_click: the link's host; collection_filter: the tab. */
  target?: string;
  /** music_play: what started it; outbound_click: where the link was; collection_filter: the view. */
  detail?: string;
  /** engagement: seconds the page was visible. */
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

export type AnalyticsOverview = {
  range: {
    range: AnalyticsRange;
    from: string;
    to: string;
    /** The period compared against: the same length right before. */
    previousFrom: string;
    previousTo: string;
    timezone: string;
  };
  current: AnalyticsKpis;
  previous: AnalyticsKpis;
  /** Hours for a single day, days otherwise. */
  trend: { bucket: "hour" | "day"; points: AnalyticsTrendPoint[] };
  topPages: { path: string; views: number; avgEngagedSeconds: number }[];
  /** Sessions active in the last five minutes. */
  online: number;
};
