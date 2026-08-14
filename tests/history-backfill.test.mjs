import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mergeBackfillDays, validateHistoryBackfill } from "../scripts/history-backfill-core.mjs";
import { run } from "../scripts/backfill-history.mjs";

const COMPOSER_A = "11111111-1111-1111-1111-111111111111";
const COMPOSER_B = "22222222-2222-2222-2222-222222222222";

function createStateDb(file) {
  const database = new DatabaseSync(file);
  database.exec("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)");
  database.exec("CREATE TABLE composerHeaders (composerId TEXT, createdAt INTEGER, lastUpdatedAt INTEGER, value TEXT)");
  const bubble = database.prepare("INSERT INTO cursorDiskKV VALUES (?, ?)");
  bubble.run(`bubbleId:${COMPOSER_A}:bubble-1`, JSON.stringify({ createdAt: "2026-02-01T12:00:00Z", text: "PRIVATE BUBBLE PROMPT", richText: "SECRET CODE" }));
  bubble.run(`bubbleId:${COMPOSER_A}:bubble-2`, JSON.stringify({ createdAt: "2026-02-02T06:59:59Z", text: "PRIVATE AGAIN" }));
  bubble.run(`bubbleId:${COMPOSER_B}:bubble-3`, JSON.stringify({ createdAt: "2026-02-01T12:00:00Z" }));
  bubble.run("codeBlockPartialInline:xyz", JSON.stringify({ createdAt: "2026-02-05T12:00:00Z" }));
  const header = database.prepare("INSERT INTO composerHeaders VALUES (?, ?, ?, ?)");
  header.run(COMPOSER_A, Date.parse("2026-02-01T12:00:00Z"), Date.parse("2026-03-01T12:00:00Z"), JSON.stringify({ totalLinesAdded: 100, totalLinesRemoved: 20, name: "PRIVATE TITLE" }));
  header.run(COMPOSER_B, Date.parse("2026-02-01T12:00:00Z"), Date.parse("2026-08-01T12:00:00Z"), JSON.stringify({ totalLinesAdded: 50, totalLinesRemoved: 0 }));
  database.close();
}

function createTrackingDb(file) {
  const database = new DatabaseSync(file);
  database.exec("CREATE TABLE ai_code_hashes (conversationId TEXT, timestamp INTEGER, requestId TEXT, fileName TEXT)");
  const insert = database.prepare("INSERT INTO ai_code_hashes VALUES (?, ?, ?, ?)");
  insert.run(COMPOSER_A, Date.parse("2026-07-14T12:00:00Z"), "request-secret", "C:/private/file.ts");
  insert.run(COMPOSER_A, Date.parse("2026-07-14T12:01:00Z"), "request-secret", "C:/private/file.ts");
  insert.run(null, Date.parse("2026-07-14T12:02:00Z"), "request-only", "C:/private/file.ts");
  database.close();
}

async function fixture(context) {
  const testRoot = await mkdtemp(path.join(tmpdir(), "history-backfill-"));
  context.after(async () => { await rm(testRoot, { recursive: true, force: true }); });
  const stateDb = path.join(testRoot, "state.vscdb");
  const trackingDb = path.join(testRoot, "tracking.db");
  const claudeRoot = path.join(testRoot, "claude");
  await mkdir(claudeRoot, { recursive: true });
  createStateDb(stateDb);
  createTrackingDb(trackingDb);
  const out = path.join(testRoot, "history-backfill.json");
  const flags = ["--state-db", stateDb, "--tracking-db", trackingDb, "--claude-root", claudeRoot, "--out", out];
  return { testRoot, stateDb, trackingDb, claudeRoot, out, flags };
}

test("backfill unions composer ids across bubbles, headers, and tracking rows on Denver days", async (context) => {
  const { out, flags } = await fixture(context);
  await run(flags);
  const backfill = validateHistoryBackfill(JSON.parse(await readFile(out, "utf8")));
  // 2026-02-01: composer A (bubble + header) and composer B (bubble + header) -> 2, deduplicated across sources.
  // 2026-02-02T06:59:59Z buckets to the previous Denver day, so 2026-02-01 stays the only February day.
  assert.deepEqual(backfill.providers.cursor.activeSessions, [
    { date: "2026-02-01", value: 2 },
    { date: "2026-07-14", value: 1 },
  ]);
  // Exact line history counts tracked rows with a conversation id only.
  assert.deepEqual(backfill.providers.cursor.appliedLineChanges, [{ date: "2026-07-14", value: 2 }]);
  assert.equal(backfill.options.approximateLines, false);
  const output = JSON.stringify(backfill);
  for (const forbidden of ["PRIVATE", "SECRET", "request-secret", "C:/private", COMPOSER_A, COMPOSER_B, "bubble-1"]) {
    assert.ok(!output.includes(forbidden), `backfill leaked ${forbidden}`);
  }
});

test("re-running merges by per-date max so recorded history never shrinks", async (context) => {
  const { out, flags, trackingDb } = await fixture(context);
  await run(flags);
  await rm(trackingDb);
  createTrackingDb(trackingDb);
  const database = new DatabaseSync(trackingDb);
  database.prepare("INSERT INTO ai_code_hashes VALUES (?, ?, ?, ?)").run(COMPOSER_B, Date.parse("2026-07-15T12:00:00Z"), null, null);
  database.close();
  await run(flags);
  const backfill = validateHistoryBackfill(JSON.parse(await readFile(out, "utf8")));
  assert.deepEqual(backfill.providers.cursor.appliedLineChanges, [
    { date: "2026-07-14", value: 2 },
    { date: "2026-07-15", value: 1 },
  ]);
});

test("approximate lines are opt-in and restricted to days before exact tracking begins", async (context) => {
  const { out, flags } = await fixture(context);
  await run([...flags, "--approximate-lines"]);
  const backfill = validateHistoryBackfill(JSON.parse(await readFile(out, "utf8")));
  assert.equal(backfill.options.approximateLines, true);
  // Composer A: 120 total lines on its 2026-03-01 lastUpdatedAt day (before exact start 2026-07-14).
  // Composer B: lastUpdatedAt 2026-08-01 is on/after exact start, so its lump sum is excluded.
  assert.deepEqual(backfill.providers.cursor.appliedLineChanges, [
    { date: "2026-03-01", value: 120 },
    { date: "2026-07-14", value: 2 },
  ]);
});

test("validateHistoryBackfill rejects unexpected fields and unsorted days", () => {
  const valid = {
    v: 1,
    generatedAt: "2026-08-13T00:00:00Z",
    timeZone: "America/Denver",
    note: "fixture",
    options: { approximateLines: false },
    providers: {
      cursor: { activeSessions: [{ date: "2026-01-01", value: 1 }], appliedLineChanges: [] },
      "claude-code": { activeSessions: [] },
    },
  };
  validateHistoryBackfill(valid);
  assert.throws(() => validateHistoryBackfill({ ...valid, extra: true }));
  assert.throws(() => validateHistoryBackfill({ ...valid, providers: { ...valid.providers, cursor: { activeSessions: [], appliedLineChanges: [], models: [] } } }));
  assert.throws(() => validateHistoryBackfill({
    ...valid,
    providers: { ...valid.providers, cursor: { activeSessions: [{ date: "2026-01-02", value: 1 }, { date: "2026-01-01", value: 1 }], appliedLineChanges: [] } },
  }));
});

test("mergeBackfillDays is a monotone per-date max", () => {
  assert.deepEqual(
    mergeBackfillDays([{ date: "2026-01-01", value: 5 }, { date: "2026-01-03", value: 2 }], [{ date: "2026-01-01", value: 3 }, { date: "2026-01-02", value: 4 }]),
    [{ date: "2026-01-01", value: 5 }, { date: "2026-01-02", value: 4 }, { date: "2026-01-03", value: 2 }],
  );
});
