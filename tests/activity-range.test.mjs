import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { rangeForBuild } from "../scripts/activity-core.mjs";

test("rangeForBuild covers the current year once it has enough days", () => {
  assert.deepEqual(rangeForBuild(new Date("2026-08-21T18:00:00Z")), { start: "2026-01-01", end: "2026-08-21" });
  assert.deepEqual(rangeForBuild(new Date("2026-03-02T18:00:00Z")), { start: "2026-01-01", end: "2026-03-02" });
});

test("rangeForBuild keeps the previous year through early January", () => {
  assert.deepEqual(rangeForBuild(new Date("2027-01-01T18:00:00Z")), { start: "2026-01-01", end: "2027-01-01" });
  assert.deepEqual(rangeForBuild(new Date("2027-02-28T18:00:00Z")), { start: "2026-01-01", end: "2027-02-28" });
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

test("the live collector bounds every GitHub network request", async () => {
  const collector = await readFile(new URL("../scripts/live-activity-collector.mjs", import.meta.url), "utf8");
  assert.match(collector, /GITHUB_REQUEST_TIMEOUT_MS\s*=\s*30_000/);
  assert.equal(
    collector.match(/AbortSignal\.timeout\(GITHUB_REQUEST_TIMEOUT_MS\)/g)?.length,
    2,
    "REST and GraphQL requests must both have a timeout",
  );
});

test("the committed snapshot covers the full rolling window", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../public/data/activity.json", import.meta.url), "utf8"));
  assert.equal(snapshot.range.start, rangeForBuild(new Date(snapshot.range.end + "T18:00:00Z")).start);
  const years = Object.keys(snapshot.summaries).sort();
  const expected = [...new Set([snapshot.range.start.slice(0, 4), snapshot.range.end.slice(0, 4)])];
  assert.deepEqual(years, expected);
});
