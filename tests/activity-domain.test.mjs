import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleSnapshot,
  dateInTimeZone,
  METRICS,
  normalizeLevels,
  unavailableProvider,
  validateSnapshot,
} from "../scripts/activity-core.mjs";

function provider(name, days, syncedAt = "2026-08-10T12:00:00Z") {
  return {
    status: "available",
    metric: METRICS[name],
    source: {
      github: "GitHub public contribution calendar",
      codex: "Local Codex session event timestamps",
      cursor: "Local Cursor AI tracking database (timestamp and requestId only)",
      "claude-code": "Local Claude Code session event timestamps",
    }[name],
    coverage: { start: days[0].date, end: days.at(-1).date },
    lastSyncedAt: syncedAt,
    days,
  };
}

test("America/Denver grouping respects the midnight boundary", () => {
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

test("Build Index equally averages only available providers", () => {
  const snapshot = assembleSnapshot({
    github: provider("github", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 9 }]),
    codex: provider("codex", [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 1 }]),
    cursor: unavailableProvider("cursor", "Local Cursor AI tracking database"),
    "claude-code": unavailableProvider("claude-code", "Local Claude Code session event timestamps"),
  }, { start: "2026-01-01", end: "2026-01-02", generatedAt: "2026-01-03T00:00:00Z" });
  assert.deepEqual(snapshot.buildIndex.days.map(({ value, level }) => ({ value, level })), [
    { value: 40, level: 2 },
    { value: 80, level: 4 },
  ]);
  assert.match(snapshot.buildIndex.disclaimer, /not a productivity score/);
});

test("missing and stale sources remain explicit", () => {
  const snapshot = assembleSnapshot({
    github: provider("github", [{ date: "2026-01-01", value: 2 }], "2025-01-01T00:00:00Z"),
    codex: unavailableProvider("codex", "Local Codex session event timestamps"),
    cursor: unavailableProvider("cursor", "Local Cursor AI tracking database"),
    "claude-code": unavailableProvider("claude-code", "Local Claude Code session event timestamps"),
  }, { start: "2026-01-01", end: "2026-01-02" });
  assert.equal(snapshot.providers.github.lastSyncedAt, "2025-01-01T00:00:00Z");
  assert.equal(snapshot.providers.codex.status, "unavailable");
  assert.deepEqual(snapshot.providers.codex.days, []);
});

test("privacy validation rejects fixtures, extra properties, and legacy units", () => {
  const base = assembleSnapshot({
    github: provider("github", [{ date: "2026-01-01", value: 1 }]),
    codex: unavailableProvider("codex", "Local Codex session event timestamps"),
    cursor: unavailableProvider("cursor", "Local Cursor AI tracking database"),
    "claude-code": unavailableProvider("claude-code", "Local Claude Code session event timestamps"),
  }, { start: "2026-01-01", end: "2026-01-01" });
  assert.throws(() => validateSnapshot({ ...base, prompt: "secret" }), /forbidden fields/);
  assert.throws(() => validateSnapshot({ ...base, mode: "fixture" }), /Fixture telemetry/);
  const legacy = structuredClone(base);
  legacy.providers.github.metric.unit = "minutes";
  assert.throws(() => validateSnapshot(legacy), /non-allowlisted metric/);
});
