import type {
  ActivityProvider,
  ActivityProviders,
  ActivitySnapshot,
  DailyActivityPoint,
  MetricActivitySnapshot,
  ProviderMetricDefinition,
} from "./types";
import { activityProviders } from "./types";

const definitions = {
  github: {
    contributions: { label: "public contributions", unit: "contributions", methodology: "Daily public contribution count from GitHub's contribution calendar.", accuracy: "observed" },
  },
  codex: {
    activeSessions: { label: "active sessions", unit: "active-sessions", methodology: "Distinct Codex sessions with an observed event on the calendar day the work happened (home base America/Denver; living-local when travelling). Annual totals are active-session-days, not lifetime sessions or token usage.", accuracy: "observed" },
  },
  cursor: {
    activeSessions: { label: "active sessions", unit: "active-sessions", methodology: "Distinct local Cursor conversations observed on the calendar day the work happened (home base America/Denver; living-local when travelling) from retained timestamps or installed user hooks.", accuracy: "observed" },
    usagePresence: { label: "verified usage days", unit: "observed-usage", methodology: "Binary presence on the calendar day the work happened (home base America/Denver; living-local when travelling) from Cursor's first-party usage export. It verifies activity without inferring a session count or publishing models, tokens, costs, billing kinds, or IDs.", accuracy: "observed" },
    appliedLineChanges: { label: "applied AI line changes", unit: "applied-ai-line-changes", methodology: "Daily additions plus deletions captured directly by local Cursor Agent or Tab edit hooks. Historical database tracking records are not line changes and are never included.", accuracy: "observed" },
  },
  "claude-code": {
    activeSessions: { label: "active sessions", unit: "active-sessions", methodology: "Distinct local Claude Code sessions with an observed event on the calendar day the work happened (home base America/Denver; living-local when travelling) from retained timestamps or installed user hooks.", accuracy: "observed" },
  },
} as const;

const retiredCursorLineDefinition: ProviderMetricDefinition = {
  label: "applied AI line changes",
  unit: "applied-ai-line-changes",
  methodology: "Daily line additions plus deletions computed in memory after local Cursor Agent or Tab edits. This is not Cursor's Team Admin API accepted-lines metric.",
  accuracy: "observed",
};

const sources = {
  github: { contributions: ["GitHub public contribution calendar", "Synthetic local development fixture"] },
  codex: { activeSessions: ["Local Codex log database (timestamp and thread_id only)", "Local Codex session event timestamps", "Synthetic local development fixture"] },
  cursor: {
    activeSessions: ["Local Cursor hooks and retained conversation timestamps", "Local Cursor hooks", "Synthetic local development fixture", "Legacy Cursor aggregate feed"],
    usagePresence: ["Cursor usage-event export (daily presence only)", "Synthetic local development fixture"],
    appliedLineChanges: ["Local Cursor Agent and Tab edit hooks", "Local Cursor edit hooks and AI code tracking history", "Synthetic local development fixture", "Legacy Cursor aggregate feed"],
  },
  "claude-code": { activeSessions: ["Local Claude Code hooks and retained session timestamps", "Local Claude Code session event timestamps", "Local Claude Code hooks", "Synthetic local development fixture", "Legacy Claude aggregate feed"] },
} as const;

const providerMetricIds = {
  github: ["contributions"],
  codex: ["activeSessions"],
  cursor: ["activeSessions", "usagePresence", "appliedLineChanges"],
  "claude-code": ["activeSessions"],
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

const ZONE_TOKEN = /(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_-]+|UTC/g;

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Compares definitions with the time-zone name normalised away. */
function sameDefinition(value: Record<string, unknown>, expected: ProviderMetricDefinition): boolean {
  const normalise = (input: unknown) => typeof input === "string" ? input.replace(ZONE_TOKEN, "{tz}") : input;
  return hasExactKeys(value, ["label", "unit", "methodology", "accuracy"])
    && Object.entries(expected).every(([key, expectedValue]) => normalise(value[key]) === normalise(expectedValue));
}

function parseDays(value: unknown, { buildIndex = false } = {}): DailyActivityPoint[] | null {
  if (!Array.isArray(value)) return null;
  const days: DailyActivityPoint[] = [];
  const seen = new Set<string>();
  for (const point of value) {
    const day = record(point);
    if (!day || !hasExactKeys(day, ["date", "value", "level"]) || !isoDate(day.date) || !integer(day.value) || !integer(day.level) || day.level > 5 || seen.has(day.date)) return null;
    if (buildIndex && day.value > 100) return null;
    seen.add(day.date);
    days.push({ date: day.date, value: day.value, level: day.level as DailyActivityPoint["level"] });
  }
  return days;
}

function parseMetric(provider: ActivityProvider, metricId: string, input: unknown): MetricActivitySnapshot | null {
  const value = record(input);
  const expected = (definitions[provider] as Record<string, ProviderMetricDefinition>)[metricId];
  const allowedSources = (sources[provider] as Record<string, readonly string[]>)[metricId];
  if (!value || !expected || !allowedSources || !hasExactKeys(value, ["status", "definition", "source", "coverage", "lastSyncedAt", "lastAttemptedAt", "days"])) return null;
  if (!["available", "stale", "unavailable"].includes(String(value.status)) || typeof value.source !== "string" || !allowedSources.includes(value.source)) return null;
  const definition = record(value.definition);
  const coverage = record(value.coverage);
  const days = parseDays(value.days);
  const definitionMatches = definition && (sameDefinition(definition, expected)
    || provider === "cursor" && metricId === "appliedLineChanges" && sameDefinition(definition, retiredCursorLineDefinition));
  if (!definitionMatches || !coverage || !hasExactKeys(coverage, ["start", "end"]) || !days) return null;
  const coverageValid = coverage.start === null && coverage.end === null
    || isoDate(coverage.start) && isoDate(coverage.end) && coverage.start <= coverage.end;
  if (!coverageValid || !(value.lastSyncedAt === null || timestamp(value.lastSyncedAt)) || !(value.lastAttemptedAt === null || timestamp(value.lastAttemptedAt))) return null;
  if (value.status === "unavailable" && (coverage.start !== null || days.length)) return null;
  return {
    status: value.status as MetricActivitySnapshot["status"],
    definition: { ...expected, methodology: typeof definition.methodology === "string" ? definition.methodology : expected.methodology },
    source: value.source,
    coverage: { start: coverage.start as string | null, end: coverage.end as string | null },
    lastSyncedAt: value.lastSyncedAt as string | null,
    lastAttemptedAt: value.lastAttemptedAt as string | null,
    days,
  };
}

function unavailableMetric(provider: ActivityProvider, metricId: string, attemptedAt: string | null = null): MetricActivitySnapshot {
  const definition = (definitions[provider] as Record<string, ProviderMetricDefinition>)[metricId];
  const source = (sources[provider] as Record<string, readonly string[]>)[metricId][0];
  return { status: "unavailable", definition: { ...definition }, source, coverage: { start: null, end: null }, lastSyncedAt: null, lastAttemptedAt: attemptedAt, days: [] };
}

function parseNestedProviders(input: unknown, version: 4 | 5): ActivityProviders | null {
  const providerInput = record(input);
  if (!providerInput || !hasExactKeys(providerInput, activityProviders)) return null;
  const output = {} as ActivityProviders;
  for (const provider of activityProviders) {
    const wrapper = record(providerInput[provider]);
    const metrics = wrapper && record(wrapper.metrics);
    const ids = version === 4 && provider === "cursor"
      ? ["activeSessions", "appliedLineChanges"] as const
      : providerMetricIds[provider];
    if (!wrapper || !hasExactKeys(wrapper, ["metrics"]) || !metrics || !hasExactKeys(metrics, ids)) return null;
    const parsed: Record<string, MetricActivitySnapshot> = {};
    for (const metricId of ids) {
      const metric = parseMetric(provider, metricId, metrics[metricId]);
      if (!metric) return null;
      parsed[metricId] = metric;
    }
    if (provider === "cursor" && version === 4) parsed.usagePresence = unavailableMetric("cursor", "usagePresence");
    (output as Record<string, unknown>)[provider] = { metrics: parsed };
  }
  return output;
}

function parseLegacyProvider(provider: ActivityProvider, input: unknown, version: 2 | 3): Record<string, MetricActivitySnapshot> | null {
  const value = record(input);
  const keys = version === 3 ? ["status", "metric", "source", "coverage", "lastSyncedAt", "lastAttemptedAt", "days"] : ["status", "metric", "source", "coverage", "lastSyncedAt", "days"];
  if (!value || !hasExactKeys(value, keys) || !["available", "stale", "unavailable"].includes(String(value.status))) return null;
  const coverage = record(value.coverage);
  const metric = record(value.metric);
  const days = parseDays(value.days);
  if (!coverage || !metric || !days || !hasExactKeys(coverage, ["start", "end"]) || typeof metric.unit !== "string") return null;
  const attemptedAt = version === 3 ? value.lastAttemptedAt : value.lastSyncedAt;
  const make = (metricId: string, source: string, metricDays = days): MetricActivitySnapshot => ({
    status: value.status as MetricActivitySnapshot["status"],
    definition: { ...(definitions[provider] as Record<string, ProviderMetricDefinition>)[metricId] },
    source,
    coverage: { start: coverage.start as string | null, end: coverage.end as string | null },
    lastSyncedAt: value.lastSyncedAt as string | null,
    lastAttemptedAt: attemptedAt as string | null,
    days: metricDays,
  });
  if (provider === "github") return { contributions: make("contributions", "GitHub public contribution calendar") };
  if (provider === "codex") return { activeSessions: make("activeSessions", "Local Codex session event timestamps") };
  if (provider === "claude-code") return { activeSessions: make("activeSessions", "Legacy Claude aggregate feed") };
  return {
    activeSessions: unavailableMetric("cursor", "activeSessions", attemptedAt as string | null),
    usagePresence: unavailableMetric("cursor", "usagePresence", attemptedAt as string | null),
    appliedLineChanges: metric.unit.includes("line") ? make("appliedLineChanges", "Legacy Cursor aggregate feed") : unavailableMetric("cursor", "appliedLineChanges", attemptedAt as string | null),
  };
}

function parseLegacyProviders(input: unknown, version: 2 | 3): ActivityProviders | null {
  const value = record(input);
  if (!value || !hasExactKeys(value, activityProviders)) return null;
  const output = {} as ActivityProviders;
  for (const provider of activityProviders) {
    const metrics = parseLegacyProvider(provider, value[provider], version);
    if (!metrics) return null;
    (output as Record<string, unknown>)[provider] = { metrics };
  }
  return output;
}

export function parseActivitySnapshot(input: unknown): ActivitySnapshot | null {
  const snapshot = record(input);
  if (!snapshot || !hasExactKeys(snapshot, ["schemaVersion", "privacyVersion", "mode", "generatedAt", "timeZone", "range", "providers", "buildIndex", "summaries"])) return null;
  const version = snapshot.schemaVersion === 2 && snapshot.privacyVersion === "aggregate-v2" ? 2
    : snapshot.schemaVersion === 3 && snapshot.privacyVersion === "aggregate-v3" ? 3
      : snapshot.schemaVersion === 4 && snapshot.privacyVersion === "aggregate-v4" ? 4
        : snapshot.schemaVersion === 5 && snapshot.privacyVersion === "aggregate-v5" ? 5 : null;
  if (!version || (snapshot.mode !== "observed" && snapshot.mode !== "fixture") || !isTimeZone(snapshot.timeZone) || !timestamp(snapshot.generatedAt)) return null;
  const range = record(snapshot.range);
  const buildIndex = record(snapshot.buildIndex);
  const summaries = record(snapshot.summaries);
  if (!range || !hasExactKeys(range, ["start", "end"]) || !isoDate(range.start) || !isoDate(range.end) || range.start > range.end || !buildIndex || !hasExactKeys(buildIndex, ["label", "formula", "disclaimer", "days"]) || buildIndex.label !== "Build Index" || typeof buildIndex.formula !== "string" || typeof buildIndex.disclaimer !== "string" || !summaries) return null;
  const providers = version === 5 ? parseNestedProviders(snapshot.providers, 5)
    : version === 4 ? parseNestedProviders(snapshot.providers, 4)
      : parseLegacyProviders(snapshot.providers, version);
  const parsedBuildDays = parseDays(buildIndex.days, { buildIndex: true });
  if (!providers || !parsedBuildDays) return null;
  const retiredLineMetric = providers.cursor.metrics.appliedLineChanges;
  providers.cursor.metrics.appliedLineChanges = unavailableMetric(
    "cursor",
    "appliedLineChanges",
    retiredLineMetric.lastAttemptedAt,
  );
  const buildDays = parsedBuildDays.map((day) => day.value > 0 && day.level === 0 ? { ...day, level: 1 as const } : day);
  const summariesOutput: ActivitySnapshot["summaries"] = {};
  for (const [year, summaryInput] of Object.entries(summaries)) {
    const summary = record(summaryInput);
    if (!/^\d{4}$/.test(year) || !summary || Object.values(summary).some((value) => !integer(value))) return null;
    const expectedKeys = version >= 4
      ? ["contributions", "codexActiveSessionDays", "cursorActiveSessionDays", "cursorAppliedAiLineChanges", "claudeActiveSessionDays", "activeDays", "longestStreak"]
      : version === 3
        ? ["contributions", "codexActiveSessionDays", "cursorAcceptedAiLineChanges", "claudeActiveSessionDays", "activeDays", "longestStreak"]
        : ["contributions", "codexActiveSessionDays", "cursorAiCodeEvents", "claudeActiveSessionDays", "activeDays", "longestStreak"];
    if (!hasExactKeys(summary, expectedKeys)) return null;
    summariesOutput[year] = {
      contributions: summary.contributions as number,
      codexActiveSessionDays: summary.codexActiveSessionDays as number,
      cursorActiveSessionDays: version >= 4 ? summary.cursorActiveSessionDays as number : 0,
      cursorAppliedAiLineChanges: 0,
      claudeActiveSessionDays: summary.claudeActiveSessionDays as number,
      activeDays: summary.activeDays as number,
      longestStreak: summary.longestStreak as number,
    };
  }
  return {
    schemaVersion: 5,
    privacyVersion: "aggregate-v5",
    mode: snapshot.mode,
    generatedAt: snapshot.generatedAt,
    timeZone: snapshot.timeZone,
    range: { start: range.start, end: range.end },
    providers,
    buildIndex: { label: "Build Index", formula: buildIndex.formula, disclaimer: buildIndex.disclaimer, days: buildDays },
    summaries: summariesOutput,
  };
}
