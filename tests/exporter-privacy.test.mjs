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

  const snapshot = await exportLocalActivity({ codexRoot, claudeRoot, cursorDatabase: databasePath });
  assert.equal(snapshot.providers.codex.metrics.activeSessions.days.length, 2);
  assert.equal(snapshot.providers.cursor.metrics.activeSessions.days[0].value, 1);
  assert.equal(snapshot.providers.cursor.metrics.appliedLineChanges.status, "unavailable");
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
  const snapshot = await exportLocalActivity({ codexRoot: path.join(testRoot, "none"), claudeRoot: path.join(testRoot, "none2"), cursorDatabase: databasePath });
  assert.equal(snapshot.providers.cursor.metrics.activeSessions.status, "unavailable");
  assert.equal(snapshot.providers.cursor.metrics.appliedLineChanges.status, "unavailable");
});
