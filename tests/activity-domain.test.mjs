import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleSnapshot,
  createMetricSeries,
  dateInTimeZone,
  HOME_TIME_ZONE,
  isTimeZone,
  resolveTimeZone,
  normalizeLevels,
  unavailableProvider,
  upgradeSnapshot,
  validateSnapshot,
} from "../scripts/activity-core.mjs";

const source = {
  github: { contributions: "GitHub public contribution calendar" },
  codex: { activeSessions: "Local Codex session event timestamps" },
  cursor: { activeSessions: "Local Cursor hooks", usagePresence: "Cursor usage-event export (daily presence only)", appliedLineChanges: "Local Cursor Agent and Tab edit hooks" },
  "claude-code": { activeSessions: "Local Claude Code session event timestamps" },
};

function provider(name, metricId, days, syncedAt = "2026-08-10T12:00:00Z") {
  const result = unavailableProvider(name);
  result.metrics[metricId] = createMetricSeries(name, metricId, source[name][metricId], days, { lastSyncedAt: syncedAt, lastAttemptedAt: syncedAt });
  return result;
}

test("America/Denver grouping respects standard and daylight midnight boundaries", () => {
  const denver = (value) => dateInTimeZone(value, "America/Denver");
  assert.equal(denver("2026-01-01T06:59:59Z"), "2025-12-31");
  assert.equal(denver("2026-01-01T07:00:00Z"), "2026-01-01");
  assert.equal(denver("2026-07-01T05:59:59Z"), "2026-06-30");
  assert.equal(denver("2026-07-01T06:00:00Z"), "2026-07-01");
});

test("normalization is monotonic and preserves zero", () => {
  const levels = normalizeLevels([0, 1, 2, 3, 4, 9]);
  assert.equal(levels[0], 0);
  assert.ok(levels.every((level, index) => index === 0 || level >= levels[index - 1]));
  assert.equal(levels.at(-1), 5);
  assert.deepEqual(normalizeLevels([0, 4, 4]), [0, 3, 3]);
});

test("Build Index gives Cursor one observed-activity input even when all Cursor metrics exist", () => {
  const cursor = provider("cursor", "activeSessions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 1 }]);
  cursor.metrics.usagePresence = createMetricSeries("cursor", "usagePresence", source.cursor.usagePresence, [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 1 }]);
  cursor.metrics.appliedLineChanges = createMetricSeries("cursor", "appliedLineChanges", source.cursor.appliedLineChanges, [{ date: "2026-01-01", value: 1000 }, { date: "2026-01-02", value: 0 }]);
  const snapshot = assembleSnapshot({
    github: provider("github", "contributions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 9 }]),
    codex: provider("codex", "activeSessions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 1 }]),
    cursor,
    "claude-code": unavailableProvider("claude-code"),
  }, { start: "2026-01-01", end: "2026-01-02", generatedAt: "2026-01-03T00:00:00Z" });
  assert.deepEqual(snapshot.buildIndex.days.map(({ value, level }) => ({ value, level })), [{ value: 47, level: 2 }, { value: 73, level: 4 }]);
  assert.equal(snapshot.schemaVersion, 5);
  assert.equal(snapshot.privacyVersion, "aggregate-v5");
  assert.equal(snapshot.summaries["2026"].cursorActiveSessionDays, 2);
  assert.equal(snapshot.summaries["2026"].cursorAppliedAiLineChanges, 1000);
  assert.match(snapshot.buildIndex.disclaimer, /never give Cursor extra weight/);
});

test("Cursor usage evidence fills missing dates at light activity without inventing sessions", () => {
  const cursor = provider("cursor", "activeSessions", [{ date: "2026-01-02", value: 1 }]);
  cursor.metrics.usagePresence = createMetricSeries("cursor", "usagePresence", source.cursor.usagePresence, [{ date: "2026-01-01", value: 1 }]);
  const snapshot = assembleSnapshot({
    github: unavailableProvider("github"),
    codex: unavailableProvider("codex"),
    cursor,
    "claude-code": unavailableProvider("claude-code"),
  }, { start: "2026-01-01", end: "2026-01-02", generatedAt: "2026-01-03T00:00:00Z" });
  assert.deepEqual(snapshot.providers.cursor.metrics.usagePresence.days, [{ date: "2026-01-01", value: 1, level: 1 }]);
  assert.deepEqual(snapshot.buildIndex.days.map(({ value, level }) => ({ value, level })), [{ value: 20, level: 1 }, { value: 60, level: 3 }]);
  assert.equal(snapshot.summaries["2026"].cursorActiveSessionDays, 1);
});

test("every positive Build Index score has a visible level while true zero stays empty", () => {
  const cursor = provider("cursor", "activeSessions", [{ date: "2026-01-01", value: 0 }, { date: "2026-01-02", value: 0 }, { date: "2026-01-03", value: 0 }]);
  const snapshot = assembleSnapshot({
    github: provider("github", "contributions", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 9 }, { date: "2026-01-03", value: 0 }]),
    codex: unavailableProvider("codex"),
    cursor,
    "claude-code": provider("claude-code", "activeSessions", [{ date: "2026-01-01", value: 0 }, { date: "2026-01-02", value: 0 }, { date: "2026-01-03", value: 0 }]),
  }, { start: "2026-01-01", end: "2026-01-03", generatedAt: "2026-01-04T00:00:00Z" });
  assert.deepEqual(snapshot.buildIndex.days.map(({ value, level }) => ({ value, level })), [{ value: 7, level: 1 }, { value: 33, level: 2 }, { value: 0, level: 0 }]);
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

test("aggregate-v4 snapshots upgrade compatibly with unavailable usage presence", () => {
  const current = assembleSnapshot({
    github: provider("github", "contributions", [{ date: "2026-01-01", value: 1 }]),
    codex: unavailableProvider("codex"), cursor: unavailableProvider("cursor"), "claude-code": unavailableProvider("claude-code"),
  }, { start: "2026-01-01", end: "2026-01-01", generatedAt: "2026-01-02T00:00:00Z" });
  const legacy = structuredClone(current);
  legacy.schemaVersion = 4;
  legacy.privacyVersion = "aggregate-v4";
  delete legacy.providers.cursor.metrics.usagePresence;
  validateSnapshot(legacy);
  const upgraded = upgradeSnapshot(legacy);
  assert.equal(upgraded.schemaVersion, 5);
  assert.equal(upgraded.providers.cursor.metrics.usagePresence.status, "unavailable");
});

test("the bucketing zone is configurable, defaults home, and rejects nonsense", () => {
  assert.equal(resolveTimeZone(""), HOME_TIME_ZONE);
  assert.equal(resolveTimeZone(null), HOME_TIME_ZONE);
  assert.equal(resolveTimeZone("America/Los_Angeles"), "America/Los_Angeles");
  assert.throws(() => resolveTimeZone("Mars/Olympus"), /not a valid IANA time zone/);
  assert.ok(isTimeZone("Asia/Kathmandu"));
  assert.ok(!isTimeZone("Not/AZone"));
});

test("a day is bucketed in the zone it is given, not the host or a fixed pin", () => {
  // 06:30Z is the hour where the two disagree: still Saturday 23:30 in
  // Pacific, already Sunday 00:30 in Denver. This is the exact misfiling that
  // emptied Saturday 2026-08-29 and cut a 24-day streak down to 1.
  const instant = "2026-08-30T06:30:00Z";
  assert.equal(dateInTimeZone(instant, "America/Los_Angeles"), "2026-08-29");
  assert.equal(dateInTimeZone(instant, "America/Denver"), "2026-08-30");
});

test("a snapshot records the zone its days were bucketed in", () => {
  const providers = {
    github: provider("github", "contributions", [{ date: "2026-08-29", value: 3 }]),
    codex: unavailableProvider("codex"),
    cursor: unavailableProvider("cursor"),
    "claude-code": unavailableProvider("claude-code"),
  };
  const snapshot = assembleSnapshot(providers, {
    start: "2026-08-01",
    end: "2026-08-30",
    generatedAt: "2026-08-30T12:00:00Z",
    timeZone: "America/Los_Angeles",
  });
  assert.equal(snapshot.timeZone, "America/Los_Angeles");
  // A rebuild elsewhere must still accept it: CI never sets ACTIVITY_TIME_ZONE,
  // and rejecting here would fail the build on correct data.
  assert.doesNotThrow(() => validateSnapshot(snapshot));
});
