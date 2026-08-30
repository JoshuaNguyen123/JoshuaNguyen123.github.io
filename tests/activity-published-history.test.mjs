import assert from "node:assert/strict";
import test from "node:test";
import {
  createMetricSeries,
  PRIVACY_VERSION,
  SCHEMA_VERSION,
  TIME_ZONE,
  unavailableProvider,
  validateRawProvider,
} from "../scripts/activity-core.mjs";
import { mergePublishedHistory, totalRecordedDays } from "../scripts/activity-published-history.mjs";

const CODEX_SOURCE = "Local Codex session event timestamps";
const CURSOR_SOURCE = "Local Cursor hooks and retained conversation timestamps";
const CURSOR_USAGE_SOURCE = "Cursor usage-event export (daily presence only)";
const CURSOR_LINES_SOURCE = "Local Cursor Agent and Tab edit hooks";
const CLAUDE_SOURCE = "Local Claude Code hooks and retained session timestamps";

function metric(provider, metricId, source, days, meta = {}) {
  return createMetricSeries(provider, metricId, source, days, { lastAttemptedAt: "2026-08-25T00:00:00.000Z", ...meta });
}

// The published feed carries a level on every day; the raw collector does not.
function published(series) {
  return { ...series, days: series.days.map((day) => ({ ...day, level: day.value > 0 ? 3 : 0 })) };
}

function providerOf(provider, metrics) {
  return validateRawProvider(provider, { metrics });
}

function localProviders({ codexDays, cursorDays, claudeDays, syncedAt = "2026-08-23T00:00:00.000Z" }) {
  return {
    codex: providerOf("codex", { activeSessions: metric("codex", "activeSessions", CODEX_SOURCE, codexDays, { lastSyncedAt: syncedAt }) }),
    cursor: providerOf("cursor", {
      activeSessions: metric("cursor", "activeSessions", CURSOR_SOURCE, cursorDays, { lastSyncedAt: syncedAt }),
      usagePresence: metric("cursor", "usagePresence", CURSOR_USAGE_SOURCE, cursorDays.map((day) => ({ ...day, value: day.value > 0 ? 1 : 0 })), { lastSyncedAt: syncedAt }),
      appliedLineChanges: metric("cursor", "appliedLineChanges", CURSOR_LINES_SOURCE, [], { lastSyncedAt: syncedAt }),
    }),
    "claude-code": providerOf("claude-code", { activeSessions: metric("claude-code", "activeSessions", CLAUDE_SOURCE, claudeDays, { lastSyncedAt: syncedAt }) }),
  };
}

function publishedSnapshot(providers, overrides = {}) {
  const local = localProviders(providers);
  return {
    mode: "observed",
    schemaVersion: SCHEMA_VERSION,
    privacyVersion: PRIVACY_VERSION,
    timeZone: TIME_ZONE,
    providers: Object.fromEntries(Object.entries(local).map(([provider, value]) => [
      provider,
      { metrics: Object.fromEntries(Object.entries(value.metrics).map(([metricId, series]) => [metricId, published(series)])) },
    ])),
    ...overrides,
  };
}

test("a rebuild carries published local history forward instead of regressing it", () => {
  // What CI can see: the committed export, two days behind.
  const providers = localProviders({
    codexDays: [{ date: "2026-08-22", value: 4 }, { date: "2026-08-23", value: 6 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }, { date: "2026-08-23", value: 5 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }, { date: "2026-08-23", value: 9 }],
  });
  // What the local publisher already pushed: the same days plus two more.
  const snapshot = publishedSnapshot({
    codexDays: [{ date: "2026-08-22", value: 4 }, { date: "2026-08-23", value: 6 }, { date: "2026-08-24", value: 11 }, { date: "2026-08-25", value: 8 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }, { date: "2026-08-23", value: 5 }, { date: "2026-08-24", value: 12 }, { date: "2026-08-25", value: 6 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }, { date: "2026-08-23", value: 9 }, { date: "2026-08-24", value: 20 }, { date: "2026-08-25", value: 14 }],
    syncedAt: "2026-08-26T05:04:42.456Z",
  });

  const carried = [];
  mergePublishedHistory(providers, snapshot, { onCarry: (provider, added) => carried.push([provider, added]) });

  const claude = providers["claude-code"].metrics.activeSessions;
  assert.equal(claude.days.reduce((sum, day) => sum + day.value, 0), 50);
  assert.equal(claude.coverage.end, "2026-08-25");
  assert.equal(claude.lastSyncedAt, "2026-08-26T05:04:42.456Z");
  assert.deepEqual(providers.codex.metrics.activeSessions.days.at(-1), { date: "2026-08-25", value: 8 });
  assert.deepEqual(carried.map(([provider]) => provider).sort(), ["claude-code", "codex", "cursor"]);
  // Every provider still satisfies the raw contract the assembler expects.
  for (const [provider, value] of Object.entries(providers)) validateRawProvider(provider, value);
});

test("the merge is a per-date maximum, so neither side can shrink the other", () => {
  const providers = localProviders({
    // The freshly collected day is larger than the one already published.
    codexDays: [{ date: "2026-08-22", value: 40 }, { date: "2026-08-23", value: 6 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }],
  });
  const snapshot = publishedSnapshot({
    codexDays: [{ date: "2026-08-22", value: 4 }, { date: "2026-08-23", value: 6 }, { date: "2026-08-24", value: 11 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }],
  });

  mergePublishedHistory(providers, snapshot);

  assert.deepEqual(providers.codex.metrics.activeSessions.days, [
    { date: "2026-08-22", value: 40 },
    { date: "2026-08-23", value: 6 },
    { date: "2026-08-24", value: 11 },
  ]);
});

test("merging is idempotent, so repeated builds converge", () => {
  const build = () => localProviders({
    codexDays: [{ date: "2026-08-22", value: 4 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }],
  });
  const snapshot = publishedSnapshot({
    codexDays: [{ date: "2026-08-22", value: 4 }, { date: "2026-08-23", value: 9 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }],
  });

  const once = mergePublishedHistory(build(), snapshot);
  const twice = mergePublishedHistory(mergePublishedHistory(build(), snapshot), snapshot);
  assert.deepEqual(twice.codex.metrics.activeSessions.days, once.codex.metrics.activeSessions.days);
});

test("an unavailable local collector still inherits the published record", () => {
  const providers = localProviders({ codexDays: [], cursorDays: [], claudeDays: [] });
  providers["claude-code"] = unavailableProvider("claude-code");
  const snapshot = publishedSnapshot({
    codexDays: [],
    cursorDays: [],
    claudeDays: [{ date: "2026-08-24", value: 20 }, { date: "2026-08-25", value: 14 }],
  });

  mergePublishedHistory(providers, snapshot);

  const claude = providers["claude-code"].metrics.activeSessions;
  assert.equal(claude.status, "available");
  assert.equal(claude.days.reduce((sum, day) => sum + day.value, 0), 34);
});

test("fixture, foreign-schema, and damaged snapshots are refused without failing the build", () => {
  const base = {
    codexDays: [{ date: "2026-08-22", value: 4 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }],
  };
  const richer = {
    codexDays: [{ date: "2026-08-22", value: 4 }, { date: "2026-08-25", value: 99 }],
    cursorDays: [{ date: "2026-08-22", value: 3 }],
    claudeDays: [{ date: "2026-08-22", value: 7 }],
  };

  for (const overrides of [{ mode: "fixture" }, { schemaVersion: SCHEMA_VERSION - 1 }, { privacyVersion: "aggregate-v1" }, { timeZone: "Not/AZone" }]) {
    const providers = localProviders(base);
    const skipped = [];
    mergePublishedHistory(providers, publishedSnapshot(richer, overrides), { onSkip: (reason) => skipped.push(reason) });
    assert.equal(totalRecordedDays(providers.codex), 4, `${JSON.stringify(overrides)} must not seed a build`);
    assert.equal(skipped.length, 1);
  }

  // A structurally broken provider is skipped on its own; the others still merge.
  const providers = localProviders(base);
  const damaged = publishedSnapshot(richer);
  damaged.providers.codex.metrics.activeSessions.days.push({ date: "not-a-date", value: 1, level: 2 });
  const skipped = [];
  mergePublishedHistory(providers, damaged, { onSkip: (reason) => skipped.push(reason) });
  assert.equal(totalRecordedDays(providers.codex), 4);
  assert.match(skipped.join(" "), /codex/);
  assert.equal(providers.cursor.metrics.activeSessions.days.length, 1);
});

test("GitHub is never carried forward, because every build refetches it", () => {
  const providers = localProviders({ codexDays: [], cursorDays: [], claudeDays: [] });
  providers.github = providerOf("github", {
    contributions: metric("github", "contributions", "GitHub public contribution calendar", [{ date: "2026-08-25", value: 2 }]),
  });
  const snapshot = publishedSnapshot({ codexDays: [], cursorDays: [], claudeDays: [] });
  snapshot.providers.github = { metrics: { contributions: published(metric("github", "contributions", "GitHub public contribution calendar", [{ date: "2026-08-25", value: 40 }])) } };

  mergePublishedHistory(providers, snapshot);

  assert.deepEqual(providers.github.metrics.contributions.days, [{ date: "2026-08-25", value: 2 }]);
});
