import { readFileSync } from "node:fs";

export const HOME_TIME_ZONE = "America/Denver";

// The calendar day a session lands on depends entirely on the zone it is
// bucketed in, and the answer people actually want is "the day I was living
// when I did the work". Pinning one zone silently misfiles every late-evening
// session while travelling: at 23:00 Pacific it is already tomorrow in Denver,
// so Saturday's work is filed under Sunday and Saturday reads as a day off --
// which is also how a streak breaks without anyone touching the data.
//
// Set ACTIVITY_TIME_ZONE while away from home; it defaults to home.
// .env.live is read here rather than by each entry point because TIME_ZONE is
// resolved at import time: a loader that runs in a module body executes after
// every static import has already been evaluated, so it would be too late. The
// scheduled collector depends on this -- it publishes hourly, and without it a
// background run would quietly re-bucket everything back to the home zone.
function timeZoneFromEnvFile() {
  try {
    const contents = readFileSync(new URL("../.env.live", import.meta.url), "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1 || line.slice(0, separator).trim() !== "ACTIVITY_TIME_ZONE") continue;
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      return value || null;
    }
  } catch { /* absent or unreadable: fall back to the home zone */ }
  return null;
}

export function resolveTimeZone(value = process.env.ACTIVITY_TIME_ZONE ?? timeZoneFromEnvFile()) {
  if (!value) return HOME_TIME_ZONE;
  if (!isTimeZone(value)) throw new Error(`ACTIVITY_TIME_ZONE is not a valid IANA time zone: ${value}`);
  return value;
}

/** True for any zone this runtime's Intl actually understands. */
export function isTimeZone(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const TIME_ZONE = resolveTimeZone();
export const PROVIDERS = ["github", "codex", "cursor", "claude-code"];
export const SCHEMA_VERSION = 5;
export const PRIVACY_VERSION = "aggregate-v5";

export const METRICS = {
  github: {
    contributions: {
      label: "public contributions",
      unit: "contributions",
      methodology: "Daily public contribution count from GitHub's contribution calendar.",
      accuracy: "observed",
    },
  },
  codex: {
    activeSessions: {
      label: "active sessions",
      unit: "active-sessions",
      methodology: `Distinct Codex sessions with an observed event on each ${TIME_ZONE} calendar day. Annual totals are active-session-days, not lifetime sessions or token usage.`,
      accuracy: "observed",
    },
  },
  cursor: {
    activeSessions: {
      label: "active sessions",
      unit: "active-sessions",
      methodology: `Distinct local Cursor conversations observed on each ${TIME_ZONE} calendar day from retained timestamps or installed user hooks.`,
      accuracy: "observed",
    },
    usagePresence: {
      label: "verified usage days",
      unit: "observed-usage",
      methodology: `Binary ${TIME_ZONE} calendar-day presence from Cursor's first-party usage export. It verifies activity without inferring a session count or publishing models, tokens, costs, billing kinds, or IDs.`,
      accuracy: "observed",
    },
    appliedLineChanges: {
      label: "applied AI line changes",
      unit: "applied-ai-line-changes",
      methodology: "Daily additions plus deletions captured directly by local Cursor Agent or Tab edit hooks. Historical database tracking records are not line changes and are never included.",
      accuracy: "observed",
    },
  },
  "claude-code": {
    activeSessions: {
      label: "active sessions",
      unit: "active-sessions",
      methodology: `Distinct local Claude Code sessions with an observed event on each ${TIME_ZONE} calendar day from retained timestamps or installed user hooks.`,
      accuracy: "observed",
    },
  },
};

export const INDEX_METRICS = {
  github: "contributions",
  codex: "activeSessions",
  cursor: "activeSessions",
  "claude-code": "activeSessions",
};

export const ALLOWED_SOURCES = {
  github: {
    contributions: ["GitHub public contribution calendar", "Synthetic local development fixture"],
  },
  codex: {
    activeSessions: [
      "Local Codex log database (timestamp and thread_id only)",
      "Local Codex session event timestamps",
      "Synthetic local development fixture",
    ],
  },
  cursor: {
    activeSessions: [
      "Local Cursor hooks and retained conversation timestamps",
      "Local Cursor hooks",
      "Synthetic local development fixture",
      "Legacy Cursor aggregate feed",
    ],
    usagePresence: [
      "Cursor usage-event export (daily presence only)",
      "Synthetic local development fixture",
    ],
    appliedLineChanges: [
      "Local Cursor Agent and Tab edit hooks",
      "Local Cursor edit hooks and AI code tracking history",
      "Synthetic local development fixture",
      "Legacy Cursor aggregate feed",
    ],
  },
  "claude-code": {
    activeSessions: [
      "Local Claude Code hooks and retained session timestamps",
      "Local Claude Code session event timestamps",
      "Local Claude Code hooks",
      "Synthetic local development fixture",
      "Legacy Claude aggregate feed",
    ],
  },
};

const DAY_MS = 86_400_000;

export function dateInTimeZone(value, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date, amount) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

// Single source of truth for the published window. The site build and the live
// feed collector MUST agree: if they drift, the dashboard renders one set of
// year tabs from the bundled snapshot and then swaps to another when the live
// feed lands, which looks like data disappearing on refresh.
//
// The window is the current year. Through the first weeks of January that would
// leave a nearly empty dashboard, so the previous year is retained until the
// current one has enough days to stand on its own.
const CARRY_PREVIOUS_YEAR_DAYS = 60;

export function rangeForBuild(now = new Date()) {
  const today = dateInTimeZone(now);
  const endYear = Number(today.slice(0, 4));
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${endYear}-01-01T00:00:00Z`)) / 86_400_000);
  const startYear = elapsed < CARRY_PREVIOUS_YEAR_DAYS ? endYear - 1 : endYear;
  return { start: `${startYear}-01-01`, end: today };
}

export function enumerateDates(start, end) {
  const dates = [];
  for (let cursor = Date.parse(`${start}T12:00:00Z`); cursor <= Date.parse(`${end}T12:00:00Z`); cursor += DAY_MS) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

function quantile(sorted, percentile) {
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function normalizeLevels(values) {
  const active = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!active.length) return values.map(() => 0);
  if (new Set(active).size === 1) return values.map((value) => (value > 0 ? 3 : 0));
  const thresholds = [0.25, 0.5, 0.75, 0.9].map((percentile) => quantile(active, percentile));
  return values.map((value) => {
    if (value <= 0) return 0;
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 4;
    return 5;
  });
}

function longestStreak(activeDates) {
  const dates = [...new Set(activeDates)].sort();
  let longest = 0;
  let current = 0;
  let previous;
  for (const date of dates) {
    current = previous && addDays(previous, 1) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function assertExactKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value);
  const unknown = actual.filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) {
    throw new Error(`${label} has invalid fields${unknown.length ? `; forbidden: ${unknown.join(", ")}` : ""}${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
  }
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Methodology prose names the zone the days were bucketed in, so a snapshot
// exported from one zone must still validate against METRICS built in another.
// Without this, any rebuild that does not happen to share the exporter's zone
// -- CI, which never sets ACTIVITY_TIME_ZONE -- fails outright.
const ZONE_TOKEN = /(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_-]+|UTC/g;

function sameDefinition(left, right) {
  const normalize = (value) => (typeof value === "string" ? value.replace(ZONE_TOKEN, "{tz}") : value);
  return Boolean(left && right)
    && Object.entries(left).every(([key, value]) => normalize(right[key]) === normalize(value))
    && Object.keys(left).length === Object.keys(right).length;
}

export function createMetricSeries(provider, metricId, source, days, {
  coverage,
  status,
  lastSyncedAt,
  lastAttemptedAt = new Date().toISOString(),
} = {}) {
  const sorted = [...days]
    .filter((day) => isDate(day.date) && Number.isInteger(day.value) && day.value >= 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  const resolvedCoverage = coverage ?? (sorted.length
    ? { start: sorted[0].date, end: sorted.at(-1).date }
    : { start: null, end: null });
  const resolvedStatus = status ?? (resolvedCoverage.start ? "available" : "unavailable");
  const result = {
    status: resolvedStatus,
    definition: METRICS[provider][metricId],
    source,
    coverage: resolvedCoverage,
    lastSyncedAt: lastSyncedAt ?? (resolvedStatus === "unavailable" ? null : lastAttemptedAt),
    lastAttemptedAt,
    days: sorted,
  };
  validateMetricSeries(provider, metricId, result);
  return result;
}

export function unavailableMetric(provider, metricId, source, { attemptedAt = null } = {}) {
  return createMetricSeries(provider, metricId, source, [], {
    status: "unavailable",
    coverage: { start: null, end: null },
    lastSyncedAt: null,
    lastAttemptedAt: attemptedAt,
  });
}

export function unavailableProvider(provider, sources = {}, { attemptedAt = null } = {}) {
  return {
    metrics: Object.fromEntries(Object.keys(METRICS[provider]).map((metricId) => [
      metricId,
      unavailableMetric(provider, metricId, sources[metricId] ?? ALLOWED_SOURCES[provider][metricId][0], { attemptedAt }),
    ])),
  };
}

export function validateMetricSeries(provider, metricId, value, { publicDays = false } = {}) {
  assertExactKeys(value, ["status", "definition", "source", "coverage", "lastSyncedAt", "lastAttemptedAt", "days"], `${provider}.${metricId}`);
  if (!Object.hasOwn(METRICS[provider] ?? {}, metricId)) throw new Error(`${provider} has an unknown metric`);
  if (!["available", "stale", "unavailable"].includes(value.status)) throw new Error(`${provider}.${metricId} has invalid status`);
  assertExactKeys(value.definition, ["label", "unit", "methodology", "accuracy"], `${provider}.${metricId}.definition`);
  if (!sameDefinition(value.definition, METRICS[provider][metricId])) throw new Error(`${provider}.${metricId} has a non-allowlisted definition`);
  if (!ALLOWED_SOURCES[provider][metricId].includes(value.source)) throw new Error(`${provider}.${metricId} has a non-allowlisted source`);
  assertExactKeys(value.coverage, ["start", "end"], `${provider}.${metricId}.coverage`);
  const coverageValid = value.coverage.start === null && value.coverage.end === null
    || isDate(value.coverage.start) && isDate(value.coverage.end) && value.coverage.start <= value.coverage.end;
  if (!coverageValid) throw new Error(`${provider}.${metricId} has invalid coverage`);
  if (value.status === "unavailable" && (value.coverage.start !== null || value.days.length)) throw new Error(`${provider}.${metricId} unavailable data must be empty`);
  if (value.lastSyncedAt !== null && !isTimestamp(value.lastSyncedAt)) throw new Error(`${provider}.${metricId} has invalid freshness metadata`);
  if (value.lastAttemptedAt !== null && !isTimestamp(value.lastAttemptedAt)) throw new Error(`${provider}.${metricId} has invalid attempt metadata`);
  if (!Array.isArray(value.days)) throw new Error(`${provider}.${metricId}.days must be an array`);
  const seen = new Set();
  for (const day of value.days) {
    assertExactKeys(day, publicDays ? ["date", "value", "level"] : ["date", "value"], `${provider}.${metricId}.day`);
    if (!isDate(day.date) || !Number.isInteger(day.value) || day.value < 0 || seen.has(day.date)) throw new Error(`${provider}.${metricId} contains an invalid daily aggregate`);
    seen.add(day.date);
    if (publicDays && (!Number.isInteger(day.level) || day.level < 0 || day.level > 5)) throw new Error(`${provider}.${metricId} contains an invalid activity level`);
  }
  return value;
}

export function validateRawProvider(provider, value, { publicDays = false } = {}) {
  assertExactKeys(value, ["metrics"], provider);
  assertExactKeys(value.metrics, Object.keys(METRICS[provider]), `${provider}.metrics`);
  for (const metricId of Object.keys(METRICS[provider])) validateMetricSeries(provider, metricId, value.metrics[metricId], { publicDays });
  return value;
}

function completeMetric(provider, metricId, raw, start, end) {
  validateMetricSeries(provider, metricId, raw);
  if (raw.status === "unavailable" || !raw.coverage.start || !raw.coverage.end) return { ...raw, days: [] };
  const first = raw.coverage.start > start ? raw.coverage.start : start;
  const last = raw.coverage.end < end ? raw.coverage.end : end;
  if (first > last) return { ...raw, days: [] };
  const byDate = new Map(raw.days.map((day) => [day.date, day.value]));
  const days = enumerateDates(first, last).map((date) => ({ date, value: byDate.get(date) ?? 0, level: 0 }));
  for (const year of new Set(days.map((day) => day.date.slice(0, 4)))) {
    const yearDays = days.filter((day) => day.date.startsWith(year));
    const levels = metricId === "usagePresence"
      ? yearDays.map((day) => (day.value > 0 ? 1 : 0))
      : normalizeLevels(yearDays.map((day) => day.value));
    yearDays.forEach((day, index) => { day.level = levels[index]; });
  }
  return { ...raw, days };
}

function completeProvider(provider, raw, start, end) {
  validateRawProvider(provider, raw);
  return {
    metrics: Object.fromEntries(Object.entries(raw.metrics).map(([metricId, metric]) => [
      metricId,
      completeMetric(provider, metricId, metric, start, end),
    ])),
  };
}

function summaryKeys(version) {
  if (version === 2) return ["contributions", "codexActiveSessionDays", "cursorAiCodeEvents", "claudeActiveSessionDays", "activeDays", "longestStreak"];
  if (version === 3) return ["contributions", "codexActiveSessionDays", "cursorAcceptedAiLineChanges", "claudeActiveSessionDays", "activeDays", "longestStreak"];
  return ["contributions", "codexActiveSessionDays", "cursorActiveSessionDays", "cursorAppliedAiLineChanges", "claudeActiveSessionDays", "activeDays", "longestStreak"];
}

function validateBuildIndex(buildIndex) {
  assertExactKeys(buildIndex, ["label", "formula", "disclaimer", "days"], "buildIndex");
  if (buildIndex.label !== "Build Index" || !Array.isArray(buildIndex.days)) throw new Error("Invalid Build Index");
  for (const day of buildIndex.days) {
    assertExactKeys(day, ["date", "value", "level"], "buildIndex.day");
    if (!isDate(day.date) || !Number.isInteger(day.value) || day.value < 0 || day.value > 100 || !Number.isInteger(day.level) || day.level < 0 || day.level > 5) throw new Error("Invalid Build Index point");
  }
}

function validateLegacySnapshot(snapshot) {
  const version = snapshot.schemaVersion === 2 && snapshot.privacyVersion === "aggregate-v2" ? 2
    : snapshot.schemaVersion === 3 && snapshot.privacyVersion === "aggregate-v3" ? 3
      : snapshot.schemaVersion === 4 && snapshot.privacyVersion === "aggregate-v4" ? 4 : null;
  if (!version) throw new Error("Unsupported activity schema");
  assertExactKeys(snapshot, ["schemaVersion", "privacyVersion", "mode", "generatedAt", "timeZone", "range", "providers", "buildIndex", "summaries"], "snapshot");
  if (!["observed", "fixture"].includes(snapshot.mode) || !isTimeZone(snapshot.timeZone) || !isTimestamp(snapshot.generatedAt)) throw new Error("Invalid legacy snapshot metadata");
  assertExactKeys(snapshot.range, ["start", "end"], "snapshot.range");
  if (!isDate(snapshot.range.start) || !isDate(snapshot.range.end) || snapshot.range.start > snapshot.range.end) throw new Error("Invalid legacy snapshot range");
  assertExactKeys(snapshot.providers, PROVIDERS, "snapshot.providers");
  if (version === 4) {
    const v4Metrics = {
      github: ["contributions"],
      codex: ["activeSessions"],
      cursor: ["activeSessions", "appliedLineChanges"],
      "claude-code": ["activeSessions"],
    };
    for (const provider of PROVIDERS) {
      const wrapper = snapshot.providers[provider];
      assertExactKeys(wrapper, ["metrics"], provider);
      assertExactKeys(wrapper.metrics, v4Metrics[provider], `${provider}.metrics`);
      for (const metricId of v4Metrics[provider]) validateMetricSeries(provider, metricId, wrapper.metrics[metricId], { publicDays: true });
    }
    validateBuildIndex(snapshot.buildIndex);
    for (const [year, summary] of Object.entries(snapshot.summaries)) {
      if (!/^\d{4}$/.test(year)) throw new Error("Invalid summary year");
      assertExactKeys(summary, summaryKeys(version), `summary.${year}`);
    }
    return version;
  }
  for (const provider of PROVIDERS) {
    const value = snapshot.providers[provider];
    const providerKeys = version === 3
      ? ["status", "metric", "source", "coverage", "lastSyncedAt", "lastAttemptedAt", "days"]
      : ["status", "metric", "source", "coverage", "lastSyncedAt", "days"];
    assertExactKeys(value, providerKeys, provider);
    if (!Array.isArray(value.days)) throw new Error(`${provider}.days must be an array`);
    for (const day of value.days) {
      assertExactKeys(day, ["date", "value", "level"], `${provider}.day`);
      if (!isDate(day.date) || !Number.isInteger(day.value) || day.value < 0) throw new Error(`${provider} contains invalid data`);
    }
  }
  validateBuildIndex(snapshot.buildIndex);
  for (const [year, summary] of Object.entries(snapshot.summaries)) {
    if (!/^\d{4}$/.test(year)) throw new Error("Invalid summary year");
    assertExactKeys(summary, summaryKeys(version), `summary.${year}`);
  }
  return version;
}

export function validateSnapshot(snapshot, { allowFixtures = false } = {}) {
  if (snapshot?.schemaVersion !== SCHEMA_VERSION || snapshot?.privacyVersion !== PRIVACY_VERSION) {
    validateLegacySnapshot(snapshot);
    if (snapshot.mode === "fixture" && !allowFixtures) throw new Error("Fixture telemetry cannot be published");
    return snapshot;
  }
  assertExactKeys(snapshot, ["schemaVersion", "privacyVersion", "mode", "generatedAt", "timeZone", "range", "providers", "buildIndex", "summaries"], "snapshot");
  if (snapshot.mode === "fixture" && !allowFixtures) throw new Error("Fixture telemetry cannot be published");
  if (!["observed", "fixture"].includes(snapshot.mode) || !isTimeZone(snapshot.timeZone) || !isTimestamp(snapshot.generatedAt)) throw new Error("Invalid snapshot metadata");
  assertExactKeys(snapshot.range, ["start", "end"], "snapshot.range");
  if (!isDate(snapshot.range.start) || !isDate(snapshot.range.end) || snapshot.range.start > snapshot.range.end) throw new Error("Invalid snapshot range");
  assertExactKeys(snapshot.providers, PROVIDERS, "snapshot.providers");
  for (const provider of PROVIDERS) validateRawProvider(provider, snapshot.providers[provider], { publicDays: true });
  validateBuildIndex(snapshot.buildIndex);
  for (const [year, summary] of Object.entries(snapshot.summaries)) {
    if (!/^\d{4}$/.test(year)) throw new Error("Invalid summary year");
    assertExactKeys(summary, summaryKeys(SCHEMA_VERSION), `summary.${year}`);
    if (Object.values(summary).some((value) => !Number.isInteger(value) || value < 0)) throw new Error(`Invalid summary for ${year}`);
  }
  return snapshot;
}

export function assembleSnapshot(rawProviders, { start, end, mode = "observed", generatedAt = new Date().toISOString(), timeZone = TIME_ZONE }) {
  const normalizedRaw = Object.fromEntries(PROVIDERS.map((provider) => [provider, upgradeProvider(provider, rawProviders[provider])]));
  const providers = Object.fromEntries(PROVIDERS.map((provider) => [provider, completeProvider(provider, normalizedRaw[provider], start, end)]));
  // The definitions come from METRICS, which names whatever zone the *building*
  // machine resolved. CI never sets ACTIVITY_TIME_ZONE, so without this a
  // scheduled rebuild would publish prose saying "America/Denver calendar day"
  // inside a snapshot whose timeZone is America/Los_Angeles. The published
  // methodology must describe the data it ships with.
  for (const provider of Object.values(providers)) {
    for (const metric of Object.values(provider.metrics)) {
      metric.definition = { ...metric.definition, methodology: metric.definition.methodology.replace(ZONE_TOKEN, timeZone) };
    }
  }
  const indexLookups = Object.fromEntries(PROVIDERS.map((provider) => {
    if (provider === "cursor") {
      const candidates = [providers.cursor.metrics.activeSessions, providers.cursor.metrics.usagePresence]
        .filter((metric) => metric.status !== "unavailable");
      const dates = new Set(candidates.flatMap((metric) => metric.days.map((day) => day.date)));
      return [provider, {
        metric: { status: candidates.length ? "available" : "unavailable" },
        days: new Map([...dates].map((date) => [date, {
          date,
          level: Math.max(...candidates.map((metric) => metric.days.find((day) => day.date === date)?.level ?? 0)),
        }])),
      }];
    }
    const metric = providers[provider].metrics[INDEX_METRICS[provider]];
    return [provider, { metric, days: new Map(metric.days.map((day) => [day.date, day])) }];
  }));
  const buildDays = enumerateDates(start, end).flatMap((date) => {
    const scores = PROVIDERS.flatMap((provider) => {
      const { metric, days } = indexLookups[provider];
      const point = days.get(date);
      return metric.status !== "unavailable" && point ? [point.level] : [];
    });
    if (!scores.length) return [];
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const value = Math.round((mean / 5) * 100);
    return [{ date, value, level: value > 0 ? Math.max(1, Math.round(mean)) : 0 }];
  });
  const sumMetric = (provider, metricId, year) => providers[provider].metrics[metricId].days
    .filter((day) => day.date.startsWith(year))
    .reduce((sum, day) => sum + day.value, 0);
  const years = [...new Set(enumerateDates(start, end).map((date) => date.slice(0, 4)))];
  const summaries = Object.fromEntries(years.map((year) => {
    const activeDates = buildDays.filter((day) => day.date.startsWith(year) && day.value > 0).map((day) => day.date);
    return [year, {
      contributions: sumMetric("github", "contributions", year),
      codexActiveSessionDays: sumMetric("codex", "activeSessions", year),
      cursorActiveSessionDays: sumMetric("cursor", "activeSessions", year),
      cursorAppliedAiLineChanges: sumMetric("cursor", "appliedLineChanges", year),
      claudeActiveSessionDays: sumMetric("claude-code", "activeSessions", year),
      activeDays: activeDates.length,
      longestStreak: longestStreak(activeDates),
    }];
  }));
  return validateSnapshot({
    schemaVersion: SCHEMA_VERSION,
    privacyVersion: PRIVACY_VERSION,
    mode,
    generatedAt,
    timeZone,
    range: { start, end },
    providers,
    buildIndex: {
      label: "Build Index",
      formula: "Equal-weight mean of GitHub contributions, Codex active sessions, Cursor observed activity, and Claude Code active sessions when each provider has coverage.",
      disclaimer: "Cursor observed activity uses session intensity when available and a light-activity floor for a date verified only by the first-party usage export. Usage evidence and applied line changes never give Cursor extra weight. The index describes observed activity, not productivity.",
      days: buildDays,
    },
    summaries,
  }, { allowFixtures: mode === "fixture" });
}

export function markMetricStale(provider, metricId, previous, attemptedAt = new Date().toISOString()) {
  if (!previous || previous.status === "unavailable" || !previous.days?.length) {
    return unavailableMetric(provider, metricId, previous?.source ?? ALLOWED_SOURCES[provider][metricId][0], { attemptedAt });
  }
  validateMetricSeries(provider, metricId, previous);
  return { ...previous, status: "stale", lastAttemptedAt: attemptedAt };
}

export function markProviderStale(provider, previous, attemptedAt = new Date().toISOString()) {
  const upgraded = upgradeProvider(provider, previous);
  return {
    metrics: Object.fromEntries(Object.entries(upgraded.metrics).map(([metricId, metric]) => [
      metricId,
      markMetricStale(provider, metricId, metric, attemptedAt),
    ])),
  };
}

function legacyProviderToV4(provider, value) {
  const now = value.lastAttemptedAt ?? value.lastSyncedAt;
  const series = (metricId, source, days = value.days) => createMetricSeries(provider, metricId, source, days.map(({ date, value: dailyValue }) => ({ date, value: dailyValue })), {
    status: value.status === "stale" ? "stale" : value.status,
    coverage: value.coverage,
    lastSyncedAt: value.lastSyncedAt,
    lastAttemptedAt: now,
  });
  if (provider === "github") return { metrics: { contributions: series("contributions", "GitHub public contribution calendar") } };
  if (provider === "codex") return { metrics: { activeSessions: series("activeSessions", value.source.includes("database") ? "Local Codex log database (timestamp and thread_id only)" : "Local Codex session event timestamps") } };
  if (provider === "claude-code") return { metrics: { activeSessions: series("activeSessions", "Legacy Claude aggregate feed") } };
  const cursorMetric = String(value.metric?.unit).includes("line") ? series("appliedLineChanges", "Legacy Cursor aggregate feed")
    : unavailableMetric("cursor", "appliedLineChanges", "Legacy Cursor aggregate feed", { attemptedAt: now });
  return {
    metrics: {
      activeSessions: unavailableMetric("cursor", "activeSessions", "Legacy Cursor aggregate feed", { attemptedAt: now }),
      usagePresence: unavailableMetric("cursor", "usagePresence", ALLOWED_SOURCES.cursor.usagePresence[0], { attemptedAt: now }),
      appliedLineChanges: cursorMetric,
    },
  };
}

export function upgradeProvider(provider, value) {
  if (value?.metrics) {
    assertExactKeys(value, ["metrics"], provider);
    const metricIds = Object.keys(METRICS[provider]);
    const unknown = Object.keys(value.metrics).filter((metricId) => !metricIds.includes(metricId));
    if (unknown.length) throw new Error(`${provider}.metrics has invalid fields; forbidden: ${unknown.join(", ")}`);
    const normalized = {
      metrics: Object.fromEntries(metricIds.map((metricId) => {
        const metric = value.metrics[metricId];
        if (!metric) return [metricId, unavailableMetric(provider, metricId, ALLOWED_SOURCES[provider][metricId][0])];
        return [metricId, {
          ...metric,
          days: Array.isArray(metric.days) ? metric.days.map(({ date, value: dailyValue }) => ({ date, value: dailyValue })) : metric.days,
        }];
      })),
    };
    return validateRawProvider(provider, normalized);
  }
  if (!value || typeof value !== "object") return unavailableProvider(provider);
  return legacyProviderToV4(provider, value);
}

export function upgradeSnapshot(snapshot) {
  validateSnapshot(snapshot, { allowFixtures: true });
  if (snapshot.schemaVersion === SCHEMA_VERSION) return snapshot;
  const providers = Object.fromEntries(PROVIDERS.map((provider) => [
    provider,
    snapshot.schemaVersion === 4
      ? upgradeProvider(provider, snapshot.providers[provider])
      : legacyProviderToV4(provider, snapshot.providers[provider]),
  ]));
  return assembleSnapshot(providers, {
    start: snapshot.range.start,
    end: snapshot.range.end,
    mode: snapshot.mode,
    generatedAt: snapshot.generatedAt,
  });
}
