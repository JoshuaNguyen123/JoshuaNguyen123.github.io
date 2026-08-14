import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { exportLocalActivity } from "../scripts/local-exporter.mjs";

test("local exporter emits aggregate sessions without prompts, paths, code, filenames, or raw IDs", async (context) => {
  const testRoot = await mkdtemp(path.join(tmpdir(), "activity-export-"));
  context.after(async () => { await rm(testRoot, { recursive: true, force: true }); });
  const codexRoot = path.join(testRoot, "codex");
  const claudeRoot = path.join(testRoot, "claude");
  await mkdir(codexRoot, { recursive: true });
  await mkdir(claudeRoot, { recursive: true });
  await writeFile(path.join(codexRoot, "session.jsonl"), [
    JSON.stringify({ timestamp: "2026-01-01T08:00:00Z", payload: { id: "codex-raw-secret", cwd: "C:/private/repository" } }),
    JSON.stringify({ timestamp: "2026-01-02T09:00:00Z", payload: { prompt: "PRIVATE PROMPT", code: "SECRET CODE" } }),
  ].join("\n"));
  await writeFile(path.join(claudeRoot, "session.jsonl"), JSON.stringify({ sessionId: "claude-raw-secret", timestamp: "2026-01-02T08:00:00Z", message: "PRIVATE CLAUDE PROMPT", filePath: "C:/private/secret.ts" }));
  const databasePath = path.join(testRoot, "cursor.db");
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE ai_code_hashes (conversationId TEXT, timestamp INTEGER, requestId TEXT, fileName TEXT, sourceCode TEXT)");
  database.prepare("INSERT INTO ai_code_hashes VALUES (?, ?, ?, ?, ?)").run("cursor-conversation-secret", Date.parse("2026-01-03T08:00:00Z"), "cursor-request-secret", "private.ts", "SECRET CURSOR CODE");
  database.close();

  const snapshot = await exportLocalActivity({ codexRoot, claudeRoot, cursorDatabase: databasePath, historyBackfill: path.join(testRoot, "missing-backfill.json") });
  assert.equal(snapshot.providers.codex.metrics.activeSessions.days.length, 2);
  assert.equal(snapshot.providers.cursor.metrics.activeSessions.days[0].value, 1);
  assert.deepEqual(snapshot.providers.cursor.metrics.appliedLineChanges.days, [{ date: "2026-01-03", value: 1 }]);
  assert.equal(snapshot.providers["claude-code"].metrics.activeSessions.days[0].value, 1);
  const output = JSON.stringify(snapshot);
  for (const forbidden of ["PRIVATE", "SECRET", "private.ts", "C:/private", "codex-raw-secret", "claude-raw-secret", "cursor-conversation-secret", "cursor-request-secret"]) assert.ok(!output.includes(forbidden), `export leaked ${forbidden}`);
});

test("Cursor local backfill uses conversation timestamps but never treats request IDs as line changes", async (context) => {
  const testRoot = await mkdtemp(path.join(tmpdir(), "cursor-export-"));
  context.after(async () => { await rm(testRoot, { recursive: true, force: true }); });
  const databasePath = path.join(testRoot, "cursor.db");
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE ai_code_hashes (timestamp INTEGER, requestId TEXT, fileName TEXT, sourceCode TEXT)");
  database.prepare("INSERT INTO ai_code_hashes VALUES (?, ?, ?, ?)").run(Date.now(), "request-only", "private.ts", "secret");
  database.close();
  const snapshot = await exportLocalActivity({ codexRoot: path.join(testRoot, "none"), claudeRoot: path.join(testRoot, "none2"), cursorDatabase: databasePath, historyBackfill: path.join(testRoot, "missing-backfill.json") });
  assert.equal(snapshot.providers.cursor.metrics.activeSessions.status, "unavailable");
  assert.equal(snapshot.providers.cursor.metrics.appliedLineChanges.status, "unavailable");
});

test("history backfill file merges by per-date max and never breaks the export when malformed", async (context) => {
  const testRoot = await mkdtemp(path.join(tmpdir(), "backfill-merge-"));
  context.after(async () => { await rm(testRoot, { recursive: true, force: true }); });
  const databasePath = path.join(testRoot, "cursor.db");
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE ai_code_hashes (conversationId TEXT, timestamp INTEGER)");
  const insert = database.prepare("INSERT INTO ai_code_hashes VALUES (?, ?)");
  insert.run("conversation-a", Date.parse("2026-07-14T12:00:00Z"));
  insert.run("conversation-a", Date.parse("2026-07-14T12:01:00Z"));
  insert.run("conversation-a", Date.parse("2026-07-14T12:02:00Z"));
  database.close();
  const backfillFile = path.join(testRoot, "history-backfill.json");
  await writeFile(backfillFile, JSON.stringify({
    v: 1,
    generatedAt: "2026-08-13T00:00:00Z",
    timeZone: "America/Denver",
    note: "test fixture",
    options: { approximateLines: false },
    providers: {
      cursor: {
        activeSessions: [{ date: "2026-02-01", value: 4 }, { date: "2026-07-14", value: 1 }],
        appliedLineChanges: [{ date: "2026-07-14", value: 5 }],
      },
      "claude-code": { activeSessions: [{ date: "2026-03-01", value: 2 }] },
    },
  }));
  const empty = path.join(testRoot, "none");
  const snapshot = await exportLocalActivity({ codexRoot: empty, claudeRoot: empty, cursorDatabase: databasePath, historyBackfill: backfillFile });
  assert.deepEqual(snapshot.providers.cursor.metrics.activeSessions.days, [{ date: "2026-02-01", value: 4 }, { date: "2026-07-14", value: 1 }]);
  assert.deepEqual(snapshot.providers.cursor.metrics.appliedLineChanges.days, [{ date: "2026-07-14", value: 5 }]);
  assert.deepEqual(snapshot.providers["claude-code"].metrics.activeSessions.days, [{ date: "2026-03-01", value: 2 }]);
  assert.equal(snapshot.providers.cursor.metrics.activeSessions.coverage.start, "2026-02-01");

  await writeFile(backfillFile, JSON.stringify({ v: 1, corrupted: true }));
  const fallback = await exportLocalActivity({ codexRoot: empty, claudeRoot: empty, cursorDatabase: databasePath, historyBackfill: backfillFile });
  assert.deepEqual(fallback.providers.cursor.metrics.appliedLineChanges.days, [{ date: "2026-07-14", value: 3 }]);
});
