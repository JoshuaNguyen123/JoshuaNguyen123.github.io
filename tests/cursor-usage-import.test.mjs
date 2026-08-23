import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CURSOR_USAGE_HEADERS,
  reduceCursorUsageCsv,
  run,
} from "../scripts/import-cursor-usage.mjs";
import { validateHistoryBackfill } from "../scripts/history-backfill-core.mjs";

function csvRow({
  date,
  cloudId = "private-cloud-id",
  model = "private-model",
  total = 10,
  cost = "Included",
} = {}) {
  return [date, cloudId, "private-automation-id", "Included", model, "No", "1", "2", "3", "4", String(total), cost]
    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
    .join(",");
}

function csv(rows) {
  return `${CURSOR_USAGE_HEADERS.join(",")}\n${rows.join("\n")}\n`;
}

test("Cursor usage CSV reduces to private, binary Denver-day evidence", () => {
  const reduced = reduceCursorUsageCsv(csv([
    csvRow({ date: "2026-07-01T05:59:59Z", model: "claude-private" }),
    csvRow({ date: "2026-07-01T06:00:00Z", cloudId: "another-private-id" }),
    csvRow({ date: "2026-07-01T12:00:00Z" }),
  ]), { now: new Date("2026-08-01T00:00:00Z") });
  assert.equal(reduced.rowCount, 3);
  assert.deepEqual(reduced.usagePresenceDays, [
    { date: "2026-06-30", value: 1 },
    { date: "2026-07-01", value: 1 },
  ]);
  const output = JSON.stringify(reduced.usagePresenceDays);
  for (const forbidden of ["private", "claude", "token", "cost", "cloud", "automation"]) assert.doesNotMatch(output, new RegExp(forbidden, "i"));
});

test("Cursor usage CSV rejects duplicates, malformed totals, and unexpected headers", () => {
  const row = csvRow({ date: "2026-01-01T12:00:00Z" });
  assert.throws(() => reduceCursorUsageCsv(csv([row, row]), { now: new Date("2026-02-01T00:00:00Z") }), /exact duplicate/);
  assert.throws(() => reduceCursorUsageCsv(csv([csvRow({ date: "2026-01-01T12:00:00Z", total: 11 })]), { now: new Date("2026-02-01T00:00:00Z") }), /inconsistent Total Tokens/);
  assert.throws(() => reduceCursorUsageCsv(csv([row]).replace("Cloud Agent ID", "Prompt"), { now: new Date("2026-02-01T00:00:00Z") }), /headers must be exactly/);
});

test("Cursor usage imports merge monotonically without retaining raw event fields", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "cursor-usage-import-"));
  context.after(async () => { await rm(root, { recursive: true, force: true }); });
  const input = path.join(root, "usage.csv");
  const out = path.join(root, "history-backfill.json");
  await writeFile(input, csv([csvRow({ date: "2026-01-01T12:00:00Z" })]));
  await run(["--input", input, "--out", out]);
  await writeFile(input, csv([csvRow({ date: "2026-01-02T12:00:00Z" })]));
  await run(["--input", input, "--out", out]);
  const backfill = validateHistoryBackfill(JSON.parse(await readFile(out, "utf8")));
  assert.deepEqual(backfill.providers.cursor.usagePresence, [
    { date: "2026-01-01", value: 1 },
    { date: "2026-01-02", value: 1 },
  ]);
  const output = await readFile(out, "utf8");
  for (const forbidden of ["private-cloud-id", "private-automation-id", "private-model", "Total Tokens", "Requests", "Cost"]) assert.doesNotMatch(output, new RegExp(forbidden, "i"));
});

test("committed Cursor usage evidence verifies the expected 96 dates", async () => {
  const backfill = validateHistoryBackfill(JSON.parse(await readFile(new URL("../data/history-backfill.json", import.meta.url), "utf8")));
  assert.equal(backfill.providers.cursor.usagePresence.length, 96);
  assert.deepEqual(backfill.providers.cursor.usagePresence.slice(0, 7).map((day) => day.date), [
    "2026-01-02", "2026-01-05", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-12", "2026-01-13",
  ]);
});

test("committed Cursor source union retains session dates and usage-only calendar evidence", async () => {
  const local = JSON.parse(await readFile(new URL("../data/local-activity.json", import.meta.url), "utf8"));
  const sessions = new Set(local.providers.cursor.metrics.activeSessions.days.filter((day) => day.value > 0).map((day) => day.date));
  const usage = new Set(local.providers.cursor.metrics.usagePresence.days.filter((day) => day.value > 0).map((day) => day.date));
  assert.equal(sessions.size, 94);
  assert.equal(usage.size, 96);
  assert.equal([...sessions].filter((date) => usage.has(date)).length, 88);
  assert.equal(new Set([...sessions, ...usage]).size, 102);
  assert.deepEqual([...usage].filter((date) => !sessions.has(date)), [
    "2026-01-02", "2026-01-05", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-12", "2026-01-13",
    // Local session evidence covers Aug 19/21/22; Aug 20 remains usage-only.
    "2026-08-20",
  ]);
  assert.deepEqual([...sessions].filter((date) => !usage.has(date)), [
    "2026-04-10", "2026-07-04", "2026-07-09", "2026-07-16", "2026-07-17", "2026-07-31",
  ]);
});
