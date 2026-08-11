export type ActivityProvider =
  | "github"
  | "codex"
  | "cursor"
  | "claude-code";

export type ActivityChannel = ActivityProvider | "overall";
export type ActivityLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type ActivityUnit =
  | "contributions"
  | "minutes"
  | "sessions"
  | "events"
  | "tokens"
  | "score";

export interface ActivityMetadata {
  contributions?: number;
  minutes?: number;
  sessions?: number;
  tokens?: number;
  repositories?: string[];
  projects?: string[];
  providerScores?: Partial<Record<ActivityProvider, number>>;
}

export interface DailyActivityPoint {
  date: string;
  provider: ActivityChannel;
  value: number;
  unit: ActivityUnit;
  level: ActivityLevel;
  metadata?: ActivityMetadata;
}

export interface DailyProviderActivity extends DailyActivityPoint {
  provider: ActivityProvider;
}

export interface ActivityProviderAdapter {
  id: ActivityProvider;
  getDailyActivity(params: {
    startDate: string;
    endDate: string;
  }): Promise<DailyProviderActivity[]>;
}

export interface ProviderActivityResult {
  status: "available" | "unavailable" | "error";
  data: DailyProviderActivity[];
  message?: string;
}

export interface ActivitySummary {
  totalContributions: number;
  totalCodingMinutes: number;
  aiSessions: number;
  activeDays: number;
  longestStreak: number;
  currentStreak: number;
  averageActiveDayMinutes: number;
}

export interface ActivityDashboardPayload {
  range: {
    start: string;
    end: string;
  };
  generatedAt: string;
  mode: "live" | "fixture" | "unconfigured";
  providers: Record<ActivityProvider, ProviderActivityResult>;
  overall: DailyActivityPoint[];
  summary: ActivitySummary;
}

export const activityProviders: ActivityProvider[] = [
  "github",
  "codex",
  "cursor",
  "claude-code",
];

export const providerLabels: Record<ActivityProvider, string> = {
  github: "GitHub",
  codex: "Codex",
  cursor: "Cursor",
  "claude-code": "Claude Code",
};
