import { enumerateDates, parseISODate } from "./calendar.ts";
import type {
  ActivityProvider,
  DailyProviderActivity,
} from "./types.ts";

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function fixtureValue(provider: ActivityProvider, date: string): number {
  const day = parseISODate(date).getUTCDay();
  const weekend = day === 0 || day === 6;
  const primary = hash(`${provider}:${date}`) % 100;
  const secondary = hash(`${date}:${provider}:depth`) % 100;
  const inactiveThreshold = weekend ? 68 : 24;
  if (primary < inactiveThreshold) return 0;

  switch (provider) {
    case "github":
      return 1 + Math.round((secondary / 100) * 21);
    case "cursor":
      return 28 + Math.round((secondary / 100) * 330);
    case "codex":
      return 12 + Math.round((secondary / 100) * 172);
    case "claude-code":
      return 8 + Math.round((secondary / 100) * 128);
  }
}

export function createFixtureActivity(
  provider: ActivityProvider,
  startDate: string,
  endDate: string,
): DailyProviderActivity[] {
  return enumerateDates(startDate, endDate).map((date) => {
    const value = fixtureValue(provider, date);
    const isAiProvider = provider === "codex" || provider === "claude-code";
    return {
      date,
      provider,
      value,
      unit: provider === "github" ? "contributions" : "minutes",
      level: 0,
      metadata: {
        ...(provider === "github" ? { contributions: value } : { minutes: value }),
        ...(isAiProvider && value > 0
          ? { sessions: Math.max(1, Math.round(value / 31)) }
          : {}),
      },
    };
  });
}
