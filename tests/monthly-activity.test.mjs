import assert from "node:assert/strict";
import test from "node:test";
import { monthlyActivity } from "../lib/activity/monthly.mjs";
const metric = (days, extra = {}) => ({ status: "available", coverage: { start: "2026-01-01", end: "2026-12-31" }, days, ...extra });

test("monthly activity distinguishes observed zero, missing coverage and partial months", () => {
  const result = monthlyActivity(metric([{ date: "2026-01-01", value: 0 }, { date: "2026-03-01", value: 8 }]), "2026-01-01", "2026-03-20");
  assert.deepEqual(result.map(m => [m.activeDays, m.coveredDays, m.elapsedDays, m.partialMonth]), [[0, 1, 31, false], [null, 0, 28, false], [1, 1, 20, true]]);
});
test("multiple sessions and duplicate evidence still count as one observed day", () => {
  const result = monthlyActivity(metric([{ date: "2026-01-01", value: 17 }, { date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 0 }]), "2026-01-01", "2026-01-02")[0];
  assert.equal(result.activeDays, 1);
  assert.equal(result.coveredDays, 2);
});
test("unavailable providers and records outside coverage never masquerade as observed days", () => {
  const days = [{ date: "2026-01-01", value: 9 }];
  assert.equal(monthlyActivity(metric(days, { status: "unavailable" }), "2026-01-01", "2026-01-20")[0].activeDays, null);
  assert.equal(monthlyActivity(metric(days, { coverage: { start: "2026-02-01", end: "2026-03-01" } }), "2026-01-01", "2026-01-20")[0].activeDays, null);
});
test("range clipping and leap years retain correct denominators without future days", () => {
  const result = monthlyActivity(metric([], { coverage: { start: null, end: null } }), "2024-02-10", "2024-03-02");
  assert.deepEqual(result.map(m => [m.elapsedDays, m.end]), [[20, "2024-02-29"], [2, "2024-03-02"]]);
});
