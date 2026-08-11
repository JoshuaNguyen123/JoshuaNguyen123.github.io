import { activityPrivacy } from "../privacy.ts";
import { withActivityCache } from "../cache.ts";
import type {
  ActivityProvider,
  ActivityProviderAdapter,
  DailyProviderActivity,
} from "../types.ts";

interface WakaTimeSummaryItem {
  name: string;
  total_seconds: number;
}

interface WakaTimeSummary {
  range: { date: string };
  grand_total: {
    total_seconds: number;
    ai_sessions?: number;
  };
  editors?: WakaTimeSummaryItem[];
  projects?: WakaTimeSummaryItem[];
}

interface WakaTimeResponse {
  data?: WakaTimeSummary[];
}

async function getWakaTimeSummaries(startDate: string, endDate: string) {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) return [];

  return withActivityCache(
    `wakatime:${startDate}:${endDate}`,
    async (): Promise<WakaTimeSummary[]> => {
      const url = new URL("https://wakatime.com/api/v1/users/current/summaries");
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${btoa(`${apiKey}:`)}`,
        },
      });
      if (!response.ok) throw new Error("WakaTime activity request failed");
      const payload = (await response.json()) as WakaTimeResponse;
      return payload.data ?? [];
    },
  );
}

const defaultMatches: Record<Exclude<ActivityProvider, "github">, string[]> = {
  cursor: ["cursor"],
  codex: ["codex", "openai"],
  "claude-code": ["claude code", "claude-code", "claude"],
};

function getMatches(provider: Exclude<ActivityProvider, "github">): string[] {
  const envName = `WAKATIME_${provider.replace("-", "_").toUpperCase()}_MATCH`;
  const configured = process.env[envName]
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured?.length ? configured : defaultMatches[provider];
}

export function createWakaTimeToolAdapter(
  provider: Exclude<ActivityProvider, "github">,
): ActivityProviderAdapter {
  return {
    id: provider,
    async getDailyActivity({ startDate, endDate }) {
      if (!process.env.WAKATIME_API_KEY) return [];
      const matches = getMatches(provider);
      const summaries = await getWakaTimeSummaries(startDate, endDate);

      return summaries.map((summary): DailyProviderActivity => {
        const seconds = (summary.editors ?? [])
          .filter((editor) =>
            matches.some((match) => editor.name.toLowerCase().includes(match)),
          )
          .reduce((total, editor) => total + editor.total_seconds, 0);
        const minutes = Math.round(seconds / 60);
        const projects = activityPrivacy.showProjectNames
          ? (summary.projects ?? []).map((project) => project.name)
          : undefined;

        return {
          date: summary.range.date,
          provider,
          value: minutes,
          unit: "minutes",
          level: 0,
          metadata: {
            minutes,
            ...(provider !== "cursor" && summary.grand_total.ai_sessions
              ? { sessions: summary.grand_total.ai_sessions }
              : {}),
            ...(projects?.length ? { projects } : {}),
          },
        };
      });
    },
  };
}
