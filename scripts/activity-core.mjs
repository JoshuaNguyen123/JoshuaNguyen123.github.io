export const TIME_ZONE = "America/Denver";
export const PROVIDERS = ["github", "codex", "cursor", "claude-code"];

export const METRICS = {
  github: {
    label: "public contributions",
    unit: "contributions",
    methodology: "Daily public contribution count from GitHub's contribution calendar.",
    accuracy: "observed",
  },
  codex: {
    label: "active sessions",
    unit: "active-sessions",
    methodology: "Distinct Codex session IDs with an observed event on each local calendar day.",
    accuracy: "observed",
  },
  cursor: {
    label: "AI code events",
    unit: "ai-code-events",
    methodology: "Distinct Cursor AI code request IDs observed by the local tracking database each day.",
    accuracy: "observed",
  },
  "claude-code": {
    label: "active sessions",
    unit: "active-sessions",
    methodology: "Distinct Claude Code session IDs with an observed event on each local calendar day.",
    accuracy: "observed",
  },
};

export const ALLOWED_SOURCES = {
  github: ["GitHub public contribution calendar", "Synthetic local development fixture"],
  codex: [
    "Local Codex log database (timestamp and thread_id only)",
    "Local Codex session event timestamps",
    "Synthetic local development fixture",
  ],
  cursor: [
    "Local Cursor AI tracking database (timestamp and requestId only)",
    "Local Cursor AI tracking database",
    "Synthetic local development fixture",
  ],
  "claude-code": ["Local Claude Code session event timestamps", "Synthetic local development fixture"],
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
    const prior = previous ? new Date(`${previous}T12:00:00Z`) : null;
    if (prior) prior.setUTCDate(prior.getUTCDate() + 1);
    current = prior?.toISOString().slice(0, 10) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function assertKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} contains forbidden fields: ${unknown.join(", ")}`);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function validateRawProvider(provider, value, { publicDays = false } = {}) {
  assertKeys(value, ["status", "metric", "source", "coverage", "lastSyncedAt", "days"], provider);
  if (!['available', 'unavailable'].includes(value.status)) throw new Error(`${provider} has invalid status`);
  assertKeys(value.metric, ["label", "unit", "methodology", "accuracy"], `${provider}.metric`);
  if (Object.entries(METRICS[provider]).some(([key, expected]) => value.metric[key] !== expected)) {
    throw new Error(`${provider} has a non-allowlisted metric definition`);
  }
  if (!ALLOWED_SOURCES[provider].includes(value.source)) throw new Error(`${provider} has a non-allowlisted source`);
  assertKeys(value.coverage, ["start", "end"], `${provider}.coverage`);
  const coverageValid = value.coverage.start === null && value.coverage.end === null
    || isDate(value.coverage.start) && isDate(value.coverage.end) && value.coverage.start <= value.coverage.end;
  if (!coverageValid) throw new Error(`${provider} has invalid coverage`);
  if (value.lastSyncedAt !== null && !isTimestamp(value.lastSyncedAt)) throw new Error(`${provider} has invalid freshness metadata`);
  if (!Array.isArray(value.days)) throw new Error(`${provider}.days must be an array`);
  for (const day of value.days) {
    assertKeys(day, publicDays ? ["date", "value", "level"] : ["date", "value"], `${provider}.day`);
    if (!isDate(day.date) || !Number.isInteger(day.value) || day.value < 0) {
      throw new Error(`${provider} contains an invalid daily aggregate`);
    }
    if (publicDays && (!Number.isInteger(day.level) || day.level < 0 || day.level > 5)) {
      throw new Error(`${provider} contains an invalid activity level`);
    }
  }
}

export function validateSnapshot(snapshot, { allowFixtures = false } = {}) {
  assertKeys(snapshot, ["schemaVersion", "privacyVersion", "mode", "generatedAt", "timeZone", "range", "providers", "buildIndex", "summaries"], "snapshot");
  if (snapshot.schemaVersion !== 1 || snapshot.privacyVersion !== "aggregate-v1") throw new Error("Unsupported activity schema");
  if (snapshot.mode === "fixture" && !allowFixtures) throw new Error("Fixture telemetry cannot be published");
  if (!['observed', 'fixture'].includes(snapshot.mode) || snapshot.timeZone !== TIME_ZONE) throw new Error("Invalid snapshot metadata");
  assertKeys(snapshot.range, ["start", "end"], "snapshot.range");
  if (!isDate(snapshot.range.start) || !isDate(snapshot.range.end) || snapshot.range.start > snapshot.range.end) throw new Error("Invalid snapshot range");
  assertKeys(snapshot.providers, PROVIDERS, "snapshot.providers");
  for (const provider of PROVIDERS) {
    validateRawProvider(provider, snapshot.providers[provider], { publicDays: true });
  }
  assertKeys(snapshot.buildIndex, ["label", "formula", "disclaimer", "days"], "buildIndex");
  if (snapshot.buildIndex.label !== "Build Index") throw new Error("Invalid Build Index label");
  for (const day of snapshot.buildIndex.days) {
    assertKeys(day, ["date", "value", "level"], "buildIndex.day");
    if (!isDate(day.date) || !Number.isInteger(day.value) || day.value < 0 || day.value > 100 || !Number.isInteger(day.level) || day.level < 0 || day.level > 5) {
      throw new Error("Invalid Build Index point");
    }
  }
  for (const [year, summary] of Object.entries(snapshot.summaries)) {
    if (!/^\d{4}$/.test(year)) throw new Error("Invalid summary year");
    assertKeys(summary, ["contributions", "codexSessions", "cursorEvents", "claudeSessions", "activeDays", "longestStreak"], `summary.${year}`);
    if (Object.values(summary).some((value) => !Number.isInteger(value) || value < 0)) throw new Error(`Invalid summary for ${year}`);
  }
  return snapshot;
}

function completeProvider(provider, raw, start, end) {
  validateRawProvider(provider, raw);
  if (raw.status === "unavailable" || !raw.coverage.start || !raw.coverage.end) return { ...raw, days: [] };
  const first = raw.coverage.start > start ? raw.coverage.start : start;
  const last = raw.coverage.end < end ? raw.coverage.end : end;
  if (first > last) return { ...raw, days: [] };
  const byDate = new Map(raw.days.map((day) => [day.date, day.value]));
  const days = enumerateDates(first, last).map((date) => ({ date, value: byDate.get(date) ?? 0, level: 0 }));
  for (const year of new Set(days.map((day) => day.date.slice(0, 4)))) {
    const yearDays = days.filter((day) => day.date.startsWith(year));
    const levels = normalizeLevels(yearDays.map((day) => day.value));
    yearDays.forEach((day, index) => { day.level = levels[index]; });
  }
  return { ...raw, days };
}

export function assembleSnapshot(rawProviders, { start, end, mode = "observed", generatedAt = new Date().toISOString() }) {
  const providers = Object.fromEntries(
    PROVIDERS.map((provider) => [provider, completeProvider(provider, rawProviders[provider], start, end)]),
  );
  const lookups = Object.fromEntries(PROVIDERS.map((provider) => [provider, new Map(providers[provider].days.map((day) => [day.date, day]))]));
  const buildDays = enumerateDates(start, end).flatMap((date) => {
    const scores = PROVIDERS.flatMap((provider) => {
      const source = providers[provider];
      const point = lookups[provider].get(date);
      return source.status === "available" && point ? [point.level] : [];
    });
    if (!scores.length) return [];
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return [{ date, value: Math.round((mean / 5) * 100), level: Math.round(mean) }];
  });
  const years = [...new Set(enumerateDates(start, end).map((date) => date.slice(0, 4)))];
  const summaries = Object.fromEntries(years.map((year) => {
    const sumProvider = (provider) => providers[provider].days.filter((day) => day.date.startsWith(year)).reduce((sum, day) => sum + day.value, 0);
    const activeDates = buildDays.filter((day) => day.date.startsWith(year) && day.value > 0).map((day) => day.date);
    return [year, {
      contributions: sumProvider("github"),
      codexSessions: sumProvider("codex"),
      cursorEvents: sumProvider("cursor"),
      claudeSessions: sumProvider("claude-code"),
      activeDays: activeDates.length,
      longestStreak: longestStreak(activeDates),
    }];
  }));
  return validateSnapshot({
    schemaVersion: 1,
    privacyVersion: "aggregate-v1",
    mode,
    generatedAt,
    timeZone: TIME_ZONE,
    range: { start, end },
    providers,
    buildIndex: {
      label: "Build Index",
      formula: "Equal-weight mean of each available provider's independently normalized daily level.",
      disclaimer: "It describes observed activity breadth and intensity; it is not a productivity score.",
      days: buildDays,
    },
    summaries,
  }, { allowFixtures: mode === "fixture" });
}

export function unavailableProvider(provider, source) {
  return {
    status: "unavailable",
    metric: METRICS[provider],
    source,
    coverage: { start: null, end: null },
    lastSyncedAt: null,
    days: [],
  };
}
