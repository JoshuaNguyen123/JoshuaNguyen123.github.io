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
    JSON.stringify({ type: "response_item", timestamp: "2026-01-01T09:00:00Z", payload: { prompt: "PRIVATE PROMPT", code: "SECRET CODE" } }),
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
  assert.equal(snapshot.providers.cursor.days[0].value, 1);
  assert.equal(snapshot.providers["claude-code"].days[0].value, 1);
  const output = JSON.stringify(snapshot);
  for (const forbidden of ["PRIVATE", "SECRET", "private.ts", "C:/private", "codex-raw-secret", "claude-raw-secret", "cursor-raw-secret"]) {
    assert.ok(!output.includes(forbidden), `export leaked ${forbidden}`);
  }
});

test("Cursor exporter source contains an allowlisted two-column query", async () => {
  const source = await readFile(new URL("../scripts/local-exporter.mjs", import.meta.url), "utf8");
  assert.match(source, /SELECT MIN\(timestamp\) AS timestamp, requestId FROM ai_code_hashes/);
  assert.doesNotMatch(source, /SELECT \*/);
});
