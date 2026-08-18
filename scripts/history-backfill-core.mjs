import { dateInTimeZone, TIME_ZONE } from "./activity-core.mjs";

export const HISTORY_BACKFILL_VERSION = 2;
export const HISTORY_BACKFILL_NOTE = "Daily aggregates recovered from retained local Cursor databases, privacy-reduced Cursor usage exports, and Claude Code transcripts. Dates and counts only; regenerating merges monotonically so recorded history never shrinks.";

const PROVIDER_SERIES = {
  cursor: ["activeSessions", "usagePresence", "appliedLineChanges"],
  "claude-code": ["activeSessions"],
};

function fail(message) {
  throw new Error(`History backfill: ${message}`);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort().join(",");
  if (actual !== [...expected].sort().join(",")) fail(`${label} must have exactly: ${expected.join(", ")}`);
}

export function createDayBucketer(timeZone = TIME_ZONE) {
  const cache = new Map();
  return (timestamp) => {
    if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) return null;
    const cacheKey = timestamp.slice(0, 13);
    let date = cache.get(cacheKey);
    if (!date) {
      date = dateInTimeZone(timestamp, timeZone);
      cache.set(cacheKey, date);
    }
    return date;
  };
}

export class DailyIdentitySets {
  #identities = new Map();
  #bucket = createDayBucketer();

  add(timestamp, identity) {
    const date = identity ? this.#bucket(timestamp) : null;
    if (!date) return;
    if (!this.#identities.has(date)) this.#identities.set(date, new Set());
    this.#identities.get(date).add(identity);
  }

  days() {
    return [...this.#identities.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, identities]) => ({ date, value: identities.size }));
  }
}

export class DailyTally {
  #totals = new Map();
  #bucket = createDayBucketer();

  add(timestamp, amount = 1) {
    const date = Number.isInteger(amount) && amount > 0 ? this.#bucket(timestamp) : null;
    if (!date) return;
    this.#totals.set(date, (this.#totals.get(date) ?? 0) + amount);
  }

  days() {
    return [...this.#totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({ date, value }));
  }
}

export function mergeBackfillDays(previous, next) {
  const byDate = new Map(previous.map((day) => [day.date, day.value]));
  for (const day of next) byDate.set(day.date, Math.max(byDate.get(day.date) ?? 0, day.value));
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));
}

function validateSeries(series, label) {
  if (!Array.isArray(series)) fail(`${label} must be an array`);
  let previousDate = "";
  for (const day of series) {
    exactKeys(day, ["date", "value"], `${label} entry`);
    if (!isDate(day.date)) fail(`${label} contains an invalid date`);
    if (!Number.isInteger(day.value) || day.value < 0) fail(`${label} contains an invalid value`);
    if (day.date <= previousDate) fail(`${label} must be sorted by date without duplicates`);
    previousDate = day.date;
  }
  return series;
}

function validateV1HistoryBackfill(value) {
  exactKeys(value, ["v", "generatedAt", "timeZone", "note", "options", "providers"], "backfill file");
  if (value.v !== 1) fail(`unsupported version ${value.v}`);
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) fail("generatedAt must be a timestamp");
  if (value.timeZone !== TIME_ZONE) fail(`timeZone must be ${TIME_ZONE}`);
  if (typeof value.note !== "string") fail("note must be a string");
  exactKeys(value.options, ["approximateLines"], "options");
  if (typeof value.options.approximateLines !== "boolean") fail("options.approximateLines must be a boolean");
  const v1Series = { cursor: ["activeSessions", "appliedLineChanges"], "claude-code": ["activeSessions"] };
  exactKeys(value.providers, Object.keys(v1Series), "providers");
  for (const [provider, seriesIds] of Object.entries(v1Series)) {
    exactKeys(value.providers[provider], seriesIds, `providers.${provider}`);
    for (const seriesId of seriesIds) validateSeries(value.providers[provider][seriesId], `providers.${provider}.${seriesId}`);
  }
  return {
    ...value,
    v: HISTORY_BACKFILL_VERSION,
    note: HISTORY_BACKFILL_NOTE,
    providers: {
      ...value.providers,
      cursor: { ...value.providers.cursor, usagePresence: [] },
    },
  };
}

export function validateHistoryBackfill(value) {
  if (value?.v === 1) return validateV1HistoryBackfill(value);
  exactKeys(value, ["v", "generatedAt", "timeZone", "note", "options", "providers"], "backfill file");
  if (value.v !== HISTORY_BACKFILL_VERSION) fail(`unsupported version ${value.v}`);
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) fail("generatedAt must be a timestamp");
  if (value.timeZone !== TIME_ZONE) fail(`timeZone must be ${TIME_ZONE}`);
  if (typeof value.note !== "string") fail("note must be a string");
  exactKeys(value.options, ["approximateLines"], "options");
  if (typeof value.options.approximateLines !== "boolean") fail("options.approximateLines must be a boolean");
  exactKeys(value.providers, Object.keys(PROVIDER_SERIES), "providers");
  for (const [provider, seriesIds] of Object.entries(PROVIDER_SERIES)) {
    exactKeys(value.providers[provider], seriesIds, `providers.${provider}`);
    for (const seriesId of seriesIds) validateSeries(value.providers[provider][seriesId], `providers.${provider}.${seriesId}`);
  }
  return value;
}

export function buildHistoryBackfill({ cursorSessionDays, cursorUsagePresenceDays = [], cursorLineDays, claudeSessionDays, approximateLines = false, generatedAt = new Date().toISOString() }) {
  return validateHistoryBackfill({
    v: HISTORY_BACKFILL_VERSION,
    generatedAt,
    timeZone: TIME_ZONE,
    note: HISTORY_BACKFILL_NOTE,
    options: { approximateLines },
    providers: {
      cursor: {
        activeSessions: validateSeries(cursorSessionDays, "cursor session days"),
        usagePresence: validateSeries(cursorUsagePresenceDays, "cursor usage-presence days"),
        appliedLineChanges: validateSeries(cursorLineDays, "cursor line days"),
      },
      "claude-code": {
        activeSessions: validateSeries(claudeSessionDays, "claude session days"),
      },
    },
  });
}

export function mergeHistoryBackfill(previous, next) {
  const prior = validateHistoryBackfill(previous);
  const incoming = validateHistoryBackfill(next);
  return buildHistoryBackfill({
    cursorSessionDays: mergeBackfillDays(prior.providers.cursor.activeSessions, incoming.providers.cursor.activeSessions),
    cursorUsagePresenceDays: mergeBackfillDays(prior.providers.cursor.usagePresence, incoming.providers.cursor.usagePresence),
    cursorLineDays: mergeBackfillDays(prior.providers.cursor.appliedLineChanges, incoming.providers.cursor.appliedLineChanges),
    claudeSessionDays: mergeBackfillDays(prior.providers["claude-code"].activeSessions, incoming.providers["claude-code"].activeSessions),
    approximateLines: prior.options.approximateLines || incoming.options.approximateLines,
    generatedAt: incoming.generatedAt,
  });
}
