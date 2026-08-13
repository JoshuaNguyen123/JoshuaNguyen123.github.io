import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleSnapshot,
  createMetricSeries,
  dateInTimeZone,
  normalizeLevels,
  unavailableProvider,
  validateSnapshot,
} from "../scripts/activity-core.mjs";

const source = {
  github: { contributions: "GitHub public contribution calendar" },
  codex: { activeSessions: "Local Codex session event timestamps" },
  cursor: { activeSessions: "Local Cursor hooks", appliedLineChanges: "Local Cursor Agent and Tab edit hooks" },
  "claude-code": { activeSessions: "Local Claude Code session event timestamps" },
};

function provider(name, metricId, days, syncedAt = "2026-08-10T12:00:00Z") {
  const result = unavailableProvider(name);
  result.metrics[metricId] = createMetricSeries(name, metricId, source[name][metricId], days, { lastSyncedAt: syncedAt, lastAttemptedAt: syncedAt });
  return result;
}

test("America/Denver grouping respects standard and daylight midnight boundaries", () => {
  assert.equal(dateInTimeZone("2026-01-01T06:59:59Z"), "2025-12-31");
  assert.equal(dateInTimeZone("2026-01-01T07:00:00Z"), "2026-01-01");
  assert.equal(dateInTimeZone("2026-07-01T05:59:59Z"), "2026-06-30");
  assert.equal(dateInTimeZone("2026-07-01T06:00:00Z"), "2026-07-01");
});

test("normalization is monotonic and preserves zero", () => {
  const levels = normalizeLevels([0, 1, 2, 3, 4, 9]);
  assert.equal(levels[0], 0);
  assert.ok(levels.every((level, index) => index === 0 || level >= levels[index - 1]));
  assert.equal(levels.at(-1), 5);
  assert.deepEqual(normalizeLevels([0, 4, 4]), [0, 3, 3]);
});

test("Build Index gives Cursor one active-session input even when both Cursor metrics exist", () => {
  const cursor = provider("cursor", "activeSessions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 1 }]);
  cursor.metrics.appliedLineChanges = createMetricSeries("cursor", "appliedLineChanges", source.cursor.appliedLineChanges, [{ date: "2026-01-01", value: 1000 }, { date: "2026-01-02", value: 0 }]);
  const snapshot = assembleSnapshot({
    github: provider("github", "contributions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 9 }]),
    codex: provider("codex", "activeSessions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 1 }]),
    cursor,
    "claude-code": unavailableProvider("claude-code"),
  }, { start: "2026-01-01", end: "2026-01-02", generatedAt: "2026-01-03T00:00:00Z" });
  assert.deepEqual(snapshot.buildIndex.days.map(({ value, level }) => ({ value, level })), [{ value: 47, level: 2 }, { value: 73, level: 4 }]);
  assert.equal(snapshot.schemaVersion, 4);
  assert.equal(snapshot.privacyVersion, "aggregate-v4");
  assert.equal(snapshot.summaries["2026"].cursorActiveSessionDays, 2);
  assert.equal(snapshot.summaries["2026"].cursorAppliedAiLineChanges, 1000);
  assert.match(snapshot.buildIndex.disclaimer, /never give Cursor extra weight/);
});

test("metric-specific missing and stale states remain explicit", () => {
  const snapshot = assembleSnapshot({
    github: provider("github", "contributions", [{ date: "2026-01-01", value: 2 }], "2025-01-01T00:00:00Z"),
    codex: unavailableProvider("codex"),
    cursor: unavailableProvider("cursor"),
    "claude-code": unavailableProvider("claude-code"),
  }, { start: "2026-01-01", end: "2026-01-02" });
  assert.equal(snapshot.providers.github.metrics.contributions.lastSyncedAt, "2025-01-01T00:00:00Z");
  assert.equal(snapshot.providers.cursor.metrics.appliedLineChanges.status, "unavailable");
  assert.deepEqual(snapshot.providers.cursor.metrics.appliedLineChanges.days, []);
});

test("privacy validation rejects fixtures, unexpected fields, and altered definitions", () => {
  const base = assembleSnapshot({
    github: provider("github", "contributions", [{ date: "2026-01-01", value: 1 }]),
    codex: unavailableProvider("codex"), cursor: unavailableProvider("cursor"), "claude-code": unavailableProvider("claude-code"),
  }, { start: "2026-01-01", end: "2026-01-01" });
  assert.throws(() => validateSnapshot({ ...base, prompt: "secret" }), /forbidden/);
  assert.throws(() => validateSnapshot({ ...base, mode: "fixture" }), /Fixture telemetry/);
  const altered = structuredClone(base);
  altered.providers.github.metrics.contributions.definition.unit = "minutes";
  assert.throws(() => validateSnapshot(altered), /non-allowlisted definition/);
  for (const forbidden of ["email", "requestId", "prompt", "code", "fileName", "path", "model", "rawResponse", "error"]) {
    const leaked = structuredClone(base);
    leaked.providers.cursor.metrics.appliedLineChanges[forbidden] = "private";
    assert.throws(() => validateSnapshot(leaked), /forbidden/, `public ${forbidden} must be rejected`);
  }
});
