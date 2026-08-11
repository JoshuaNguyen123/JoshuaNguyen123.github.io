import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCalendarWeeks,
  enumerateDates,
} from "../lib/activity/calendar.ts";
import { normalizeActivityLevels } from "../lib/activity/normalize.ts";
import { getCurrentStreak, getLongestStreak } from "../lib/activity/streaks.ts";
import {
  assembleActivityPayload,
  buildOverallActivity,
} from "../lib/activity/aggregate.ts";

test("calendar places dates by UTC weekday and handles partial weeks", () => {
  const weeks = buildCalendarWeeks("2026-01-01", "2026-01-10");
  assert.equal(weeks[0].cells[4].date, "2026-01-01");
  assert.equal(weeks[0].cells[4].inRange, true);
  assert.equal(weeks[0].cells[3].inRange, false);
  assert.equal(weeks.at(-1).cells[6].date, "2026-01-10");
});

test("calendar covers leap days, year boundaries, and 365-day ranges", () => {
  assert.ok(enumerateDates("2024-02-28", "2024-03-01").includes("2024-02-29"));
  assert.deepEqual(enumerateDates("2025-12-31", "2026-01-01"), ["2025-12-31", "2026-01-01"]);
  assert.equal(enumerateDates("2025-01-01", "2025-12-31").length, 365);
});

test("normalization handles zero, uniform, sparse, and outlier data", () => {
  assert.deepEqual(normalizeActivityLevels([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(normalizeActivityLevels([0, 8, 8]), [0, 3, 3]);
  assert.equal(normalizeActivityLevels([0, 1, 1, 1, 100]).at(-1), 5);
  const distribution = normalizeActivityLevels([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(distribution[0], 1);
  assert.equal(distribution.at(-1), 5);
});

test("streaks handle empty data, gaps, current runs, and year boundaries", () => {
  assert.equal(getLongestStreak([]), 0);
  assert.equal(getLongestStreak(["2025-12-31", "2026-01-01", "2026-01-03"]), 2);
  assert.equal(getCurrentStreak(["2026-01-01"], "2026-01-01"), 1);
  assert.equal(getCurrentStreak(["2026-01-01", "2026-01-02"], "2026-01-03"), 0);
});

function result(provider, values, status = "available") {
  return {
    status,
    data: values.map(([date, value, level]) => ({
      date,
      provider,
      value,
      level,
      unit: provider === "github" ? "contributions" : "minutes",
    })),
  };
}

test("overall aggregation averages only providers with actual data", () => {
  const providers = {
    github: result("github", [["2026-01-01", 4, 4]]),
    codex: result("codex", [["2026-01-01", 20, 2]]),
    cursor: result("cursor", [], "unavailable"),
    "claude-code": result("claude-code", [["2026-01-01", 0, 0]]),
  };
  const overall = buildOverallActivity(providers, "2026-01-01", "2026-01-01");
  assert.equal(overall[0].level, 3);
  assert.equal(overall[0].value, 60);
});

test("payload summary handles multiple and missing providers", () => {
  const providers = {
    github: result("github", [["2026-01-01", 4, 0]]),
    codex: result("codex", [["2026-01-01", 30, 0]]),
    cursor: result("cursor", [["2026-01-02", 90, 0]]),
    "claude-code": result("claude-code", [], "unavailable"),
  };
  const payload = assembleActivityPayload(providers, "2026-01-01", "2026-01-02", "live");
  assert.equal(payload.summary.totalContributions, 4);
  assert.equal(payload.summary.totalCodingMinutes, 120);
  assert.equal(payload.summary.activeDays, 2);
  assert.equal(payload.summary.longestStreak, 2);
});
