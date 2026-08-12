import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { exportLocalActivity } from "../scripts/local-exporter.mjs";

test("local exporter emits counts but no prompts, paths, code, filenames, or raw IDs", async (context) => {
  const testRoot = await mkdtemp(path.join(tmpdir(), "activity-export-"));
  context.after(async () => { await rm(testRoot, { recursive: true, force: true }); });
  const codexRoot = path.join(testRoot, "codex");
  const claudeRoot = path.join(testRoot, "claude");
  await mkdir(codexRoot, { recursive: true });
  await mkdir(claudeRoot, { recursive: true });
  await writeFile(path.join(codexRoot, "session.jsonl"), [
    JSON.stringify({ type: "session_meta", timestamp: "2026-01-01T08:00:00Z", payload: { id: "codex-raw-secret", cwd: "C:/private/repository" } }),
    JSON.stringify({ type: "response_item", timestamp: "2026-01-01T09:00:00Z", payload: { prompt: "PRIVATE PROMPT", code: "SECRET CODE", timestamp: "2026-03-03T09:00:00Z" } }),
    JSON.stringify({ type: "response_item", timestamp: "2026-01-02T09:00:00Z", payload: { prompt: "PRIVATE SECOND-DAY PROMPT" } }),
  ].join("\n"));
  await writeFile(path.join(claudeRoot, "session.jsonl"), JSON.stringify({
    sessionId: "claude-raw-secret", timestamp: "2026-01-02T08:00:00Z", message: "PRIVATE CLAUDE PROMPT", filePath: "C:/private/secret.ts",
  }));
  const databasePath = path.join(testRoot, "cursor.db");
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE ai_code_hashes (timestamp INTEGER, requestId TEXT, fileName TEXT, sourceCode TEXT)");
  database.prepare("INSERT INTO ai_code_hashes VALUES (?, ?, ?, ?)").run(Date.parse("2026-01-03T08:00:00Z"), "cursor-raw-secret", "private.ts", "SECRET CURSOR CODE");
  database.close();

  const snapshot = await exportLocalActivity({ codexRoot, claudeRoot, cursorDatabase: databasePath });
  assert.equal(snapshot.providers.codex.days[0].value, 1);
  assert.equal(snapshot.providers.codex.days[1].value, 1);
  assert.equal(snapshot.providers.codex.days.length, 2);
  assert.equal(snapshot.providers.cursor.status, "unavailable");
  assert.deepEqual(snapshot.providers.cursor.days, []);
  assert.equal(snapshot.providers["claude-code"].days[0].value, 1);
  const output = JSON.stringify(snapshot);
  for (const forbidden of ["PRIVATE", "SECRET", "private.ts", "C:/private", "codex-raw-secret", "claude-raw-secret", "cursor-raw-secret"]) {
    assert.ok(!output.includes(forbidden), `export leaked ${forbidden}`);
  }
});

test("Cursor request IDs are never published as AI Line Edits", async () => {
  const source = await readFile(new URL("../scripts/local-exporter.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /FROM ai_code_hashes/);
  assert.match(source, /aggregate export not configured/);
});
