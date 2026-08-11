import { assembleActivityPayload } from "./aggregate.ts";
import { createFixtureActivity } from "./fixtures.ts";
import { daysBetween } from "./calendar.ts";
import { githubActivityAdapter } from "./providers/github.ts";
import { createWakaTimeToolAdapter } from "./providers/wakatime.ts";
import type {
  ActivityDashboardPayload,
  ActivityProvider,
  ActivityProviderAdapter,
  ProviderActivityResult,
} from "./types.ts";
import { activityProviders } from "./types.ts";

const adapters: Record<ActivityProvider, ActivityProviderAdapter> = {
  github: githubActivityAdapter,
  codex: createWakaTimeToolAdapter("codex"),
  cursor: createWakaTimeToolAdapter("cursor"),
  "claude-code": createWakaTimeToolAdapter("claude-code"),
};

function isConfigured(provider: ActivityProvider): boolean {
  return provider === "github"
    ? Boolean(process.env.GITHUB_USERNAME && process.env.GITHUB_TOKEN)
    : Boolean(process.env.WAKATIME_API_KEY);
}

function shouldUseFixtures(): boolean {
  if (process.env.ACTIVITY_USE_FIXTURES === "true") return true;
  if (process.env.ACTIVITY_USE_FIXTURES === "false") return false;
  return process.env.NODE_ENV === "development";
}

async function loadProvider(
  provider: ActivityProvider,
  startDate: string,
  endDate: string,
  fixtures: boolean,
): Promise<ProviderActivityResult> {
  if (fixtures) {
    return {
      status: "available",
      data: createFixtureActivity(provider, startDate, endDate),
      message: "Deterministic development data",
    };
  }

  if (!isConfigured(provider)) {
    return {
      status: "unavailable",
      data: [],
      message: provider === "github" ? "GitHub not configured" : "Telemetry not configured",
    };
  }

  try {
    return {
      status: "available",
      data: await adapters[provider].getDailyActivity({ startDate, endDate }),
    };
  } catch {
    return {
      status: "error",
      data: [],
      message: "Activity temporarily unavailable",
    };
  }
}

export async function getActivityDashboard(
  startDate: string,
  endDate: string,
): Promise<ActivityDashboardPayload> {
  const length = daysBetween(startDate, endDate);
  if (length < 0 || length > 366) throw new Error("Activity range must be 367 days or less");

  const fixtures = shouldUseFixtures();
  const entries = await Promise.all(
    activityProviders.map(async (provider) => [
      provider,
      await loadProvider(provider, startDate, endDate, fixtures),
    ] as const),
  );
  const providers = Object.fromEntries(entries) as Record<
    ActivityProvider,
    ProviderActivityResult
  >;
  const hasLiveProvider = activityProviders.some(
    (provider) => providers[provider].status === "available",
  );

  return assembleActivityPayload(
    providers,
    startDate,
    endDate,
    fixtures ? "fixture" : hasLiveProvider ? "live" : "unconfigured",
  );
}
