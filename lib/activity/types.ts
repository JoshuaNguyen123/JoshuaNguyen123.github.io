export type ActivityProvider = "github" | "codex" | "cursor" | "claude-code";
export type ActivityChannel = ActivityProvider | "build-index";
export type ActivityLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type ActivityUnit = "contributions" | "active-sessions" | "ai-code-events";

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

export interface ProviderActivitySnapshot {
  status: "available" | "unavailable";
  metric: ProviderMetricDefinition;
  source: string;
  coverage: ProviderCoverage;
  lastSyncedAt: string | null;
  days: DailyActivityPoint[];
}

export interface BuildIndexSnapshot {
  label: "Build Index";
  formula: string;
  disclaimer: string;
  days: DailyActivityPoint[];
}

export interface ActivitySummary {
  contributions: number;
  codexSessions: number;
  cursorEvents: number;
  claudeSessions: number;
  activeDays: number;
  longestStreak: number;
}

export interface ActivitySnapshot {
  schemaVersion: 1;
  privacyVersion: "aggregate-v1";
  mode: "observed" | "fixture";
  generatedAt: string;
  timeZone: "America/Denver";
  range: { start: string; end: string };
  providers: Record<ActivityProvider, ProviderActivitySnapshot>;
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
