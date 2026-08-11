import { enumerateDates } from "./calendar.ts";
import { normalizeProviderActivity } from "./normalize.ts";
import { getCurrentStreak, getLongestStreak } from "./streaks.ts";
import type {
  ActivityDashboardPayload,
  ActivityProvider,
  ActivitySummary,
  DailyActivityPoint,
  DailyProviderActivity,
  ProviderActivityResult,
} from "./types.ts";
import { activityProviders } from "./types.ts";

function emptyPoint(
  provider: ActivityProvider,
  date: string,
): DailyProviderActivity {
  return {
    date,
    provider,
    value: 0,
    unit: provider === "github" ? "contributions" : "minutes",
    level: 0,
  };
}

export function fillProviderDateRange(
  provider: ActivityProvider,
  data: DailyProviderActivity[],
  startDate: string,
  endDate: string,
): DailyProviderActivity[] {
  const byDate = new Map(data.map((point) => [point.date, point]));
  return normalizeProviderActivity(
    enumerateDates(startDate, endDate).map(
      (date) => byDate.get(date) ?? emptyPoint(provider, date),
    ),
  );
}

export function buildOverallActivity(
  providers: Record<ActivityProvider, ProviderActivityResult>,
  startDate: string,
  endDate: string,
): DailyActivityPoint[] {
  const included = activityProviders.filter((provider) => {
    const result = providers[provider];
    return (
      result.status === "available" && result.data.some((point) => point.value > 0)
    );
  });

  const lookups = Object.fromEntries(
    included.map((provider) => [
      provider,
      new Map(providers[provider].data.map((point) => [point.date, point])),
    ]),
  ) as Partial<Record<ActivityProvider, Map<string, DailyProviderActivity>>>;

  return enumerateDates(startDate, endDate).map((date) => {
    const providerScores = Object.fromEntries(
      included.map((provider) => [provider, lookups[provider]?.get(date)?.level ?? 0]),
    ) as Partial<Record<ActivityProvider, number>>;
    const scores = Object.values(providerScores);
    const meanLevel =
      scores.length > 0
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : 0;

    return {
      date,
      provider: "overall",
      value: Math.round((meanLevel / 5) * 100),
      unit: "score",
      level: Math.round(meanLevel) as 0 | 1 | 2 | 3 | 4 | 5,
      metadata: { providerScores },
    };
  });
}

export function calculateActivitySummary(
  providers: Record<ActivityProvider, ProviderActivityResult>,
  endDate: string,
): ActivitySummary {
  const availableData = activityProviders.flatMap((provider) =>
    providers[provider].status === "available" ? providers[provider].data : [],
  );
  const github = providers.github.data;
  const coding = ["cursor", "codex", "claude-code"].flatMap(
    (provider) => providers[provider as ActivityProvider].data,
  );
  const activeDates = [
    ...new Set(
      availableData.filter((point) => point.value > 0).map((point) => point.date),
    ),
  ];
  const totalCodingMinutes = Math.round(
    coding.reduce((total, point) => total + point.value, 0),
  );
  const aiSessions = coding.reduce(
    (total, point) => total + (point.metadata?.sessions ?? 0),
    0,
  );

  return {
    totalContributions: Math.round(
      github.reduce((total, point) => total + point.value, 0),
    ),
    totalCodingMinutes,
    aiSessions,
    activeDays: activeDates.length,
    longestStreak: getLongestStreak(activeDates),
    currentStreak: getCurrentStreak(activeDates, endDate),
    averageActiveDayMinutes:
      activeDates.length > 0 ? Math.round(totalCodingMinutes / activeDates.length) : 0,
  };
}

export function assembleActivityPayload(
  providers: Record<ActivityProvider, ProviderActivityResult>,
  startDate: string,
  endDate: string,
  mode: ActivityDashboardPayload["mode"],
): ActivityDashboardPayload {
  const completedProviders = Object.fromEntries(
    activityProviders.map((provider) => {
      const result = providers[provider];
      return [
        provider,
        result.status === "available"
          ? {
              ...result,
              data: fillProviderDateRange(
                provider,
                result.data,
                startDate,
                endDate,
              ),
            }
          : result,
      ];
    }),
  ) as Record<ActivityProvider, ProviderActivityResult>;

  return {
    range: { start: startDate, end: endDate },
    generatedAt: new Date().toISOString(),
    mode,
    providers: completedProviders,
    overall: buildOverallActivity(completedProviders, startDate, endDate),
    summary: calculateActivitySummary(completedProviders, endDate),
  };
}
