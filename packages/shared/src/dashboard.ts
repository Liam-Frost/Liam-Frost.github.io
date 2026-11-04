import type { AnalyticsKpis, AnalyticsSystemEvent } from "./analytics";
import type { MediaKind, MediaSource } from "./api";

/** One part of the dashboard: its data, or why it could not be loaded (the other parts still load). */
export type DashboardPart<T> = { ok: true; data: T } | { ok: false; error: string };

export type DashboardTraffic = {
  /** Sessions active in the last five minutes. */
  online: number;
  today: AnalyticsKpis;
  /** Yesterday up to the same time of day. */
  yesterday: AnalyticsKpis;
  /** The last seven days, oldest first. */
  week: { day: string; views: number; visitors: number }[];
};

export type DashboardContent = {
  photos: { total: number; hidden: number; featured: number; referenced: number };
  projects: { total: number; hidden: number; featured: number };
  media: {
    total: number;
    hidden: number;
    watching: number;
    byKind: { kind: MediaKind; count: number }[];
  };
  people: { total: number; hidden: number };
  playlists: { total: number; hidden: number };
};

export type DashboardTaskId =
  | "photos-referenced"
  | "photos-missing-en"
  | "projects-missing-en"
  | "projects-no-cover"
  | "media-unrated"
  | "steam-stale"
  | "source-failing";

/** Something to look at, with where to fix it. */
export type DashboardTask = {
  id: DashboardTaskId;
  /** For "source-failing": the source; otherwise absent. */
  subject?: string;
  /** For "media-unrated": the kind with the most such entries, so the link opens that tab. */
  kind?: MediaKind;
  severity: "warning" | "info";
  count: number;
  /** A few of the items, each with its own admin path when it has one. */
  examples: { id: string; name: string; to: string | null }[];
};

/** A media source's key and its recent answers. */
export type DashboardSource = {
  name: MediaSource;
  /** Needs a key or app set in the environment. */
  needsKey: boolean;
  configured: boolean;
  lastOk: string | null;
  lastError: string | null;
  lastErrorMessage: string | null;
};

export type DashboardConnections = {
  steam: {
    configured: boolean;
    account: {
      name: string;
      lastSyncedAt: string | null;
      /** Not synced for 30 days (the same rule as the "steam-stale" task). */
      stale: boolean;
    } | null;
  };
  spotify: { configured: boolean; account: { displayName: string } | null };
  sources: DashboardSource[];
};

export type DashboardEditedType = "photo" | "project" | "media" | "person" | "playlist";

export type DashboardActivity = {
  /** Import and sync jobs, newest first. */
  jobs: AnalyticsSystemEvent[];
  /** Recently edited content, newest first. */
  edited: {
    type: DashboardEditedType;
    id: string;
    name: string;
    /** Collection entries: movie, track, ... */
    kind: MediaKind | null;
    updatedAt: string;
    to: string;
  }[];
};

export type AdminDashboard = {
  generatedAt: string;
  /** null when analytics is off or there is no database. */
  traffic: DashboardPart<DashboardTraffic> | null;
  content: DashboardPart<DashboardContent>;
  tasks: DashboardPart<DashboardTask[]>;
  connections: DashboardPart<DashboardConnections>;
  activity: DashboardPart<DashboardActivity>;
};
