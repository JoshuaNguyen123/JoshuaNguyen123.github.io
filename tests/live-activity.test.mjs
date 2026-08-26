import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createMetricSeries, unavailableProvider } from "../scripts/activity-core.mjs";
import { lineChangeCounts, reduceHookPayload, writeSpoolEvent } from "../scripts/local-hook-core.mjs";
import { applySpoolEvents, consumeHookSpool, mergeHookLedger, readHookState, snapshotsMatch, validateLedger } from "../scripts/live-activity-core.mjs";

const secret = "test-secret-with-at-least-thirty-two-characters";

test("Cursor line diff handles LF, CRLF, replacements, additions, and deletions", () => {
  assert.deepEqual(lineChangeCounts("a\nb", "a\nc"), { additions: 1, deletions: 1, total: 2 });
  assert.deepEqual(lineChangeCounts("a\r\nb", "a\r\nb\r\nc"), { additions: 1, deletions: 0, total: 1 });
  assert.deepEqual(lineChangeCounts("a\nb", ""), { additions: 0, deletions: 2, total: 2 });
});

test("Cursor line diff bounds adversarial inputs before quadratic work", () => {
  const before = `${"before\n".repeat(40_000)}tail`;
  const after = `${"after\n".repeat(40_000)}tail`;
  const started = performance.now();
  assert.deepEqual(lineChangeCounts(before, after), { additions: 40_001, deletions: 40_001, total: 80_002 });
  assert.ok(performance.now() - started < 1_000, "bounded fallback should remain linear");
  assert.deepEqual(lineChangeCounts(before, before), { additions: 0, deletions: 0, total: 0 });
});

test("Cursor Agent and Tab hooks reduce raw payloads to privacy-safe aggregates", () => {
  const now = new Date("2026-01-02T08:00:00Z");
  const agent = reduceHookPayload("cursor-agent-edit", { conversation_id: "private-conversation", file_path: "C:/secret.ts", model: "private-model", edits: [{ old_string: "a", new_string: "b\nc" }] }, secret, now);
  const tab = reduceHookPayload("cursor-tab-edit", { generation_id: "private-generation", edits: [{ old_line: "x", new_line: "y" }] }, secret, now);
  assert.equal(agent.lineChanges, 3);
  assert.equal(tab.lineChanges, 2);
  const output = JSON.stringify([agent, tab]);
  assert.doesNotMatch(output, /secret|private|conversation|generation|model|file/i);
});

test("Claude hooks map sessions to the Denver day and daily keyed hashes deduplicate", () => {
  const first = reduceHookPayload("claude-session", { session_id: "private-session", transcript_path: "C:/secret.jsonl" }, secret, new Date("2026-01-02T06:59:59Z"));
  const second = reduceHookPayload("claude-activity", { session_id: "private-session", tool_input: { file_path: "C:/secret.ts" } }, secret, new Date("2026-01-02T06:59:59Z"));
  assert.equal(first.date, "2026-01-01");
  const ledger = applySpoolEvents(validateLedger({ v: 1, providers: { cursor: { sessions: {}, lineChanges: {} }, "claude-code": { sessions: {} } } }), [first, second]);
  assert.equal(ledger.providers["claude-code"].sessions["2026-01-01"].length, 1);
});

test("concurrent spool files are consumed once and merged with partial backfill", async (context) => {
  const activityHome = await mkdtemp(path.join(tmpdir(), "hook-spool-"));
  context.after(async () => { await rm(activityHome, { recursive: true, force: true }); });
  await writeFile(path.join(activityHome, "config.json"), JSON.stringify({ hookSecret: secret, installedAt: "2026-01-02T12:00:00Z" }));
  const events = Array.from({ length: 12 }, (_, index) => reduceHookPayload("cursor-agent-edit", { conversation_id: `session-${index % 2}`, edits: [{ old_string: "a", new_string: "b" }] }, secret, new Date("2026-01-03T12:00:00Z")));
  await Promise.all(events.map((event) => writeSpoolEvent(activityHome, event)));
  const preview = await readHookState(activityHome);
  assert.equal(preview.consumed, 12);
  assert.equal(preview.ledger.providers.cursor.sessions["2026-01-03"].length, 2);
  assert.equal((await readdir(path.join(activityHome, "spool"))).length, 12);
  const state = await consumeHookSpool(activityHome);
  assert.equal(state.consumed, 12);
  assert.equal(state.ledger.providers.cursor.sessions["2026-01-03"].length, 2);
  assert.equal(state.ledger.providers.cursor.lineChanges["2026-01-03"], 24);
  assert.equal((await consumeHookSpool(activityHome)).consumed, 0);

  const cursor = unavailableProvider("cursor");
  cursor.metrics.activeSessions = createMetricSeries("cursor", "activeSessions", "Local Cursor hooks and retained conversation timestamps", [
    { date: "2026-01-01", value: 3 },
    { date: "2026-01-03", value: 5 },
  ]);
  cursor.metrics.appliedLineChanges = createMetricSeries("cursor", "appliedLineChanges", "Local Cursor edit hooks and AI code tracking history", [
    { date: "2026-01-01", value: 7 },
    { date: "2026-01-02", value: 9 },
  ]);
  const providers = mergeHookLedger({ codex: unavailableProvider("codex"), cursor, "claude-code": unavailableProvider("claude-code") }, state, "2026-01-03T13:00:00Z");
  assert.deepEqual(providers.cursor.metrics.activeSessions.days, [
    { date: "2026-01-01", value: 3 },
    { date: "2026-01-02", value: 0 },
    { date: "2026-01-03", value: 5 },
  ]);
  assert.deepEqual(providers.cursor.metrics.appliedLineChanges.days, [
    { date: "2026-01-03", value: 24 },
  ]);
  assert.equal(providers.cursor.metrics.appliedLineChanges.coverage.start, "2026-01-03");
});

test("publisher no-op comparison ignores freshness but detects aggregate changes", () => {
  const metric = createMetricSeries("cursor", "activeSessions", "Local Cursor hooks", [{ date: "2026-01-01", value: 1 }], { lastSyncedAt: "2026-01-01T00:00:00Z" });
  const base = { generatedAt: "2026-01-01T00:00:00Z", providers: { cursor: { metrics: { activeSessions: metric } } } };
  const same = structuredClone(base);
  same.generatedAt = "2026-01-01T00:05:00Z";
  same.providers.cursor.metrics.activeSessions.lastSyncedAt = "2026-01-01T00:05:00Z";
  assert.equal(snapshotsMatch(base, same), true);
  same.providers.cursor.metrics.activeSessions.days[0].value = 2;
  assert.equal(snapshotsMatch(base, same), false);
});
