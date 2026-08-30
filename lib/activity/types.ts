export type ActivityProvider = "github" | "codex" | "cursor" | "claude-code";
export type ActivityChannel = ActivityProvider | "build-index";
export type ActivityLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type ActivityUnit = "contributions" | "active-sessions" | "observed-usage" | "applied-ai-line-changes" | "normalized-index";
export type ProviderStatus = "available" | "stale" | "unavailable";
export type ActivityMetricId = "contributions" | "activeSessions" | "usagePresence" | "appliedLineChanges";

export interface DailyActivityPoint {
  date: string;
  value: number;
  level: ActivityLevel;
}

export interface ProviderCoverage {
  start: string | null;
  end: string | null;
}

export interface ProviderMetricDefinition {
  label: string;
  unit: ActivityUnit;
  methodology: string;
  accuracy: "observed";
}

export interface MetricActivitySnapshot {
  status: ProviderStatus;
  definition: ProviderMetricDefinition;
  source: string;
  coverage: ProviderCoverage;
  lastSyncedAt: string | null;
  lastAttemptedAt: string | null;
  days: DailyActivityPoint[];
}

export interface ProviderMetricMap {
  github: { contributions: MetricActivitySnapshot };
  codex: { activeSessions: MetricActivitySnapshot };
  cursor: { activeSessions: MetricActivitySnapshot; usagePresence: MetricActivitySnapshot; appliedLineChanges: MetricActivitySnapshot };
  "claude-code": { activeSessions: MetricActivitySnapshot };
}

export type ProviderActivitySnapshot<P extends ActivityProvider = ActivityProvider> = {
  metrics: ProviderMetricMap[P];
};

export type ActivityProviders = { [P in ActivityProvider]: ProviderActivitySnapshot<P> };

export interface BuildIndexSnapshot {
  label: "Build Index";
  formula: string;
  disclaimer: string;
  days: DailyActivityPoint[];
}

export interface ActivitySummary {
  contributions: number;
  codexActiveSessionDays: number;
  cursorActiveSessionDays: number;
  cursorAppliedAiLineChanges: number;
  claudeActiveSessionDays: number;
  activeDays: number;
  longestStreak: number;
}

export interface ActivitySnapshot {
  schemaVersion: 5;
  privacyVersion: "aggregate-v5";
  mode: "observed" | "fixture";
  generatedAt: string;
  timeZone: string;
  range: { start: string; end: string };
  providers: ActivityProviders;
  buildIndex: BuildIndexSnapshot;
  summaries: Record<string, ActivitySummary>;
}

export const activityProviders: ActivityProvider[] = ["github", "codex", "cursor", "claude-code"];

export const providerLabels: Record<ActivityProvider, string> = {
  github: "GitHub",
  codex: "Codex",
  cursor: "Cursor",
  "claude-code": "Claude Code",
};
