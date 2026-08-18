import type { DailyActivityPoint, MetricActivitySnapshot, ProviderStatus } from "./types";

const observedDefinition = {
  label: "observed activity",
  unit: "observed-usage" as const,
  methodology: "Union of exact Cursor session evidence and privacy-reduced first-party usage presence. Session intensity is retained; a usage-only date is shown as light activity without inventing a session count.",
  accuracy: "observed" as const,
};

function latestTimestamp(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function combinedStatus(metrics: MetricActivitySnapshot[]): ProviderStatus {
  if (metrics.some((metric) => metric.status === "available")) return "available";
  if (metrics.some((metric) => metric.status === "stale")) return "stale";
  return "unavailable";
}

export function combineCursorActivity(
  sessions: MetricActivitySnapshot,
  usagePresence: MetricActivitySnapshot,
): MetricActivitySnapshot {
  const metrics = [sessions, usagePresence];
  const available = metrics.filter((metric) => metric.status !== "unavailable");
  const dates = new Set(available.flatMap((metric) => metric.days.map((day) => day.date)));
  const sessionDays = new Map(sessions.days.map((day) => [day.date, day]));
  const usageDays = new Map(usagePresence.days.map((day) => [day.date, day]));
  const days: DailyActivityPoint[] = [...dates].sort().map((date) => {
    const session = sessionDays.get(date);
    const usage = usageDays.get(date);
    const active = Boolean((session?.value ?? 0) > 0 || (usage?.value ?? 0) > 0);
    return {
      date,
      value: active ? 1 : 0,
      level: Math.max(session?.level ?? 0, usage?.value ? 1 : 0) as DailyActivityPoint["level"],
    };
  });
  const starts = available.map((metric) => metric.coverage.start).filter((value): value is string => Boolean(value)).sort();
  const ends = available.map((metric) => metric.coverage.end).filter((value): value is string => Boolean(value)).sort();
  return {
    status: combinedStatus(metrics),
    definition: observedDefinition,
    source: "Combined Cursor session and usage-presence evidence",
    coverage: { start: starts[0] ?? null, end: ends.at(-1) ?? null },
    lastSyncedAt: latestTimestamp(available.map((metric) => metric.lastSyncedAt)),
    lastAttemptedAt: latestTimestamp(available.map((metric) => metric.lastAttemptedAt)),
    days,
  };
}

export function countActiveDays(metric: MetricActivitySnapshot): number {
  return metric.days.filter((day) => day.value > 0).length;
}
