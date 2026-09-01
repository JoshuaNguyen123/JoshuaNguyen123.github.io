import { dateInTimeZone, HOME_TIME_ZONE, isTimeZone, mergeWriteOnceDays, TIME_ZONE } from "./activity-core.mjs";

export const HISTORY_BACKFILL_VERSION = 3;
export const HISTORY_BACKFILL_NOTE = "Daily session aggregates recovered from retained local Cursor databases and Claude Code transcripts, plus privacy-reduced Cursor usage exports and provider-attributed GitHub repository evidence. GitHub evidence is binary presence only and never invents a session count. Database tracking rows are not treated as line changes. Dates and counts only.";

const PROVIDER_SERIES = {
  codex: ["repositoryEvidence"],
  cursor: ["activeSessions", "usagePresence", "appliedLineChanges"],
  "claude-code": ["activeSessions", "repositoryEvidence"],
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
    const instant = typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
    if (typeof timestamp !== "string" || Number.isNaN(instant)) return null;
    // See DailyIdentityCounter in local-exporter.mjs: keying on the raw string
    // prefix dropped the offset and aliased instants hours apart.
    const cacheKey = Math.floor(instant / 60_000);
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
  return mergeWriteOnceDays(previous, next, { sameZone: true });
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

function upgradeLegacyHistoryBackfill(value) {
  exactKeys(value, ["v", "generatedAt", "timeZone", "note", "options", "providers"], "backfill file");
  if (![1, 2].includes(value.v)) fail(`unsupported version ${value.v}`);
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) fail("generatedAt must be a timestamp");
  if (!isTimeZone(value.timeZone)) fail("timeZone must be a valid IANA time zone");
  if (typeof value.note !== "string") fail("note must be a string");
  exactKeys(value.options, ["approximateLines"], "options");
  if (typeof value.options.approximateLines !== "boolean") fail("options.approximateLines must be a boolean");
  const legacySeries = {
    cursor: value.v === 1 ? ["activeSessions", "appliedLineChanges"] : ["activeSessions", "usagePresence", "appliedLineChanges"],
    "claude-code": ["activeSessions"],
  };
  exactKeys(value.providers, Object.keys(legacySeries), "providers");
  for (const [provider, seriesIds] of Object.entries(legacySeries)) {
    exactKeys(value.providers[provider], seriesIds, `providers.${provider}`);
    for (const seriesId of seriesIds) validateSeries(value.providers[provider][seriesId], `providers.${provider}.${seriesId}`);
  }
  return {
    ...value,
    v: HISTORY_BACKFILL_VERSION,
    note: HISTORY_BACKFILL_NOTE,
    options: { approximateLines: false },
    providers: {
      codex: { repositoryEvidence: [] },
      cursor: {
        ...value.providers.cursor,
        usagePresence: value.v === 1 ? [] : value.providers.cursor.usagePresence,
        appliedLineChanges: [],
      },
      "claude-code": { ...value.providers["claude-code"], repositoryEvidence: [] },
    },
  };
}

export function validateHistoryBackfill(value) {
  if (value?.v === 1 || value?.v === 2) return upgradeLegacyHistoryBackfill(value);
  exactKeys(value, ["v", "generatedAt", "timeZone", "note", "options", "providers"], "backfill file");
  if (value.v !== HISTORY_BACKFILL_VERSION) fail(`unsupported version ${value.v}`);
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) fail("generatedAt must be a timestamp");
  if (!isTimeZone(value.timeZone)) fail("timeZone must be a valid IANA time zone");
  if (typeof value.note !== "string") fail("note must be a string");
  exactKeys(value.options, ["approximateLines"], "options");
  if (typeof value.options.approximateLines !== "boolean") fail("options.approximateLines must be a boolean");
  exactKeys(value.providers, Object.keys(PROVIDER_SERIES), "providers");
  for (const [provider, seriesIds] of Object.entries(PROVIDER_SERIES)) {
    exactKeys(value.providers[provider], seriesIds, `providers.${provider}`);
    for (const seriesId of seriesIds) validateSeries(value.providers[provider][seriesId], `providers.${provider}.${seriesId}`);
  }
  // Version 2 files may contain the retired ai_code_hashes row count in the
  // appliedLineChanges slot. It was never a line-diff measurement, so sanitize
  // it at every read boundary instead of allowing an old file to republish it.
  return {
    ...value,
    note: HISTORY_BACKFILL_NOTE,
    options: { approximateLines: false },
    providers: {
      ...value.providers,
      cursor: { ...value.providers.cursor, appliedLineChanges: [] },
    },
  };
}

export function buildHistoryBackfill({ codexRepositoryEvidenceDays = [], cursorSessionDays, cursorUsagePresenceDays = [], cursorLineDays, claudeSessionDays, claudeRepositoryEvidenceDays = [], approximateLines = false, generatedAt = new Date().toISOString() }) {
  return validateHistoryBackfill({
    v: HISTORY_BACKFILL_VERSION,
    generatedAt,
    timeZone: HOME_TIME_ZONE,
    note: HISTORY_BACKFILL_NOTE,
    options: { approximateLines },
    providers: {
      codex: {
        repositoryEvidence: validateSeries(codexRepositoryEvidenceDays, "codex repository-evidence days"),
      },
      cursor: {
        activeSessions: validateSeries(cursorSessionDays, "cursor session days"),
        usagePresence: validateSeries(cursorUsagePresenceDays, "cursor usage-presence days"),
        appliedLineChanges: validateSeries(cursorLineDays, "cursor line days"),
      },
      "claude-code": {
        activeSessions: validateSeries(claudeSessionDays, "claude session days"),
        repositoryEvidence: validateSeries(claudeRepositoryEvidenceDays, "claude repository-evidence days"),
      },
    },
  });
}

export function mergeHistoryBackfill(previous, next) {
  const prior = validateHistoryBackfill(previous);
  const incoming = validateHistoryBackfill(next);
  const today = dateInTimeZone(new Date());
  const sameZone = prior.timeZone === incoming.timeZone;
  const merge = (frozen, nextDays) => mergeWriteOnceDays(frozen, nextDays, { today, sameZone });
  return buildHistoryBackfill({
    codexRepositoryEvidenceDays: merge(prior.providers.codex.repositoryEvidence, incoming.providers.codex.repositoryEvidence),
    cursorSessionDays: merge(prior.providers.cursor.activeSessions, incoming.providers.cursor.activeSessions),
    cursorUsagePresenceDays: merge(prior.providers.cursor.usagePresence, incoming.providers.cursor.usagePresence),
    cursorLineDays: merge(prior.providers.cursor.appliedLineChanges, incoming.providers.cursor.appliedLineChanges),
    claudeSessionDays: merge(prior.providers["claude-code"].activeSessions, incoming.providers["claude-code"].activeSessions),
    claudeRepositoryEvidenceDays: merge(prior.providers["claude-code"].repositoryEvidence, incoming.providers["claude-code"].repositoryEvidence),
    approximateLines: false,
    generatedAt: incoming.generatedAt,
  });
}
