import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { rangeForBuild } from "../scripts/activity-core.mjs";

test("rangeForBuild is a rolling two-year window ending today", () => {
  assert.deepEqual(rangeForBuild(new Date("2026-08-21T18:00:00Z")), { start: "2025-01-01", end: "2026-08-21" });
  assert.deepEqual(rangeForBuild(new Date("2027-01-01T18:00:00Z")), { start: "2026-01-01", end: "2027-01-01" });
});

// The bundled snapshot and the live feed must cover the same window. When they
// drift, the page renders one set of year tabs and then swaps to another as soon
// as the live feed resolves, which reads as data vanishing on refresh.
test("the build and the live collector derive their window from the same helper", async () => {
  const [prepare, collector] = await Promise.all([
    readFile(new URL("../scripts/prepare-activity.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/live-activity-collector.mjs", import.meta.url), "utf8"),
  ]);
  for (const [name, source] of [["prepare-activity", prepare], ["live-activity-collector", collector]]) {
    assert.match(source, /rangeForBuild/, `${name} must derive its window from rangeForBuild`);
    assert.doesNotMatch(source, /=\s*"\d{4}-01-01"/, `${name} must not hardcode a window start`);
  }
});

test("the committed snapshot covers the full rolling window", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../public/data/activity.json", import.meta.url), "utf8"));
  assert.equal(snapshot.range.start, rangeForBuild(new Date(snapshot.range.end + "T18:00:00Z")).start);
  const years = Object.keys(snapshot.summaries).sort();
  assert.deepEqual(years, [snapshot.range.start.slice(0, 4), snapshot.range.end.slice(0, 4)]);
});
