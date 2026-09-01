import type { DailyActivityPoint, MetricActivitySnapshot, ProviderStatus } from "./types";

function latestTimestamp(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function combinedStatus(metrics: MetricActivitySnapshot[]): ProviderStatus {
  if (metrics.some((metric) => metric.status === "available")) return "available";
  if (metrics.some((metric) => metric.status === "stale")) return "stale";
  return "unavailable";
}

function combinePresenceActivity(
  sessions: MetricActivitySnapshot,
  presence: MetricActivitySnapshot,
  methodology: string,
  source: string,
): MetricActivitySnapshot {
  const metrics = [sessions, presence];
  const available = metrics.filter((metric) => metric.status !== "unavailable");
  const dates = new Set(available.flatMap((metric) => metric.days.map((day) => day.date)));
  const sessionDays = new Map(sessions.days.map((day) => [day.date, day]));
  const presenceDays = new Map(presence.days.map((day) => [day.date, day]));
  const days: DailyActivityPoint[] = [...dates].sort().map((date) => {
    const session = sessionDays.get(date);
    const observed = presenceDays.get(date);
    const active = Boolean((session?.value ?? 0) > 0 || (observed?.value ?? 0) > 0);
    return {
      date,
      value: active ? 1 : 0,
      level: Math.max(session?.level ?? 0, observed?.value ? 1 : 0) as DailyActivityPoint["level"],
    };
  });
  const starts = available.map((metric) => metric.coverage.start).filter((value): value is string => Boolean(value)).sort();
  const ends = available.map((metric) => metric.coverage.end).filter((value): value is string => Boolean(value)).sort();
  return {
    status: combinedStatus(metrics),
    definition: {
      label: "observed activity",
      unit: "observed-usage",
      methodology,
      accuracy: "observed",
    },
    source,
    coverage: { start: starts[0] ?? null, end: ends.at(-1) ?? null },
    lastSyncedAt: latestTimestamp(available.map((metric) => metric.lastSyncedAt)),
    lastAttemptedAt: latestTimestamp(available.map((metric) => metric.lastAttemptedAt)),
    days,
  };
}

export function combineCursorActivity(
  sessions: MetricActivitySnapshot,
  usagePresence: MetricActivitySnapshot,
): MetricActivitySnapshot {
  return combinePresenceActivity(
    sessions,
    usagePresence,
    "Union of exact Cursor session evidence and privacy-reduced first-party usage presence. Session intensity is retained; a usage-only date is shown as light activity without inventing a session count.",
    "Combined Cursor session and usage-presence evidence",
  );
}

export function combineRepositoryActivity(
  sessions: MetricActivitySnapshot,
  repositoryEvidence: MetricActivitySnapshot,
  providerLabel: string,
): MetricActivitySnapshot {
  return combinePresenceActivity(
    sessions,
    repositoryEvidence,
    `Union of retained ${providerLabel} session counts and provider-attributed GitHub repository evidence. Session intensity is retained; an evidence-only date is shown as light activity without inventing a session count.`,
    `Combined ${providerLabel} session and GitHub repository evidence`,
  );
}

export function countActiveDays(metric: MetricActivitySnapshot): number {
  return metric.days.filter((day) => day.value > 0).length;
}
