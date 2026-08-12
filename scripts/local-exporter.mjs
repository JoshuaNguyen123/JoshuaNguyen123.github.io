import { createReadStream, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dateInTimeZone, METRICS, TIME_ZONE, validateRawProvider } from "./activity-core.mjs";

async function listJsonlFiles(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

async function readLinePrefixes(file, onPrefix, limit = 4096) {
  let prefix = "";
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    let start = 0;
    let index = chunk.indexOf(10, start);
    while (index !== -1) {
      if (prefix.length < limit) prefix += chunk.subarray(start, Math.min(index, start + limit - prefix.length)).toString("utf8");
      onPrefix(prefix);
      prefix = "";
      start = index + 1;
      index = chunk.indexOf(10, start);
    }
    if (start < chunk.length && prefix.length < limit) prefix += chunk.subarray(start, start + limit - prefix.length).toString("utf8");
  }
  if (prefix) onPrefix(prefix);
}

class DailyIdentityCounter {
  #identities = new Map();
  #dateCache = new Map();

  add(timestamp, transientId) {
    if (!timestamp || !transientId) return;
    const cacheKey = timestamp.slice(0, 13);
    let date = this.#dateCache.get(cacheKey);
    if (!date) {
      if (Number.isNaN(Date.parse(timestamp))) return;
      date = dateInTimeZone(timestamp);
      this.#dateCache.set(cacheKey, date);
    }
    if (!this.#identities.has(date)) this.#identities.set(date, new Set());
    this.#identities.get(date).add(transientId);
  }

  days() {
    return [...this.#identities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, identities]) => ({ date, value: identities.size }));
  }
}

function availableProvider(provider, source, days) {
  const now = new Date().toISOString();
  const result = {
    status: days.length ? "available" : "unavailable",
    metric: METRICS[provider],
    source,
    coverage: days.length ? { start: days[0].date, end: days.at(-1).date } : { start: null, end: null },
    lastSyncedAt: days.length ? now : null,
    days,
  };
  validateRawProvider(provider, result);
  return result;
}

export async function exportCodex(root) {
  const counter = new DailyIdentityCounter();
  for (const file of await listJsonlFiles(root)) {
    const transientId = path.basename(file, ".jsonl");
    await readLinePrefixes(file, (prefix) => {
      const timestamp = prefix.match(/"timestamp":"([^"]+)"/)?.[1];
      if (timestamp) counter.add(timestamp, transientId);
    }, 512);
  }
  return availableProvider("codex", "Local Codex session event timestamps", counter.days());
}

export function exportCodexDatabase(databasePath) {
  if (!existsSync(databasePath)) return availableProvider("codex", "Local Codex log database (timestamp and thread_id only)", []);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database.prepare(
      "SELECT MIN(ts) AS timestamp, thread_id FROM logs WHERE ts IS NOT NULL AND thread_id IS NOT NULL GROUP BY thread_id, date(ts, 'unixepoch', 'localtime')",
    ).all();
    const counter = new DailyIdentityCounter();
    for (const row of rows) counter.add(new Date(Number(row.timestamp) * 1000).toISOString(), String(row.thread_id));
    return availableProvider("codex", "Local Codex log database (timestamp and thread_id only)", counter.days());
  } finally {
    database.close();
  }
}

export async function exportClaude(root) {
  const counter = new DailyIdentityCounter();
  for (const file of await listJsonlFiles(root)) {
    await readLinePrefixes(file, (prefix) => {
      const timestamp = prefix.match(/"timestamp":"([^"]+)"/)?.[1];
      const sessionId = prefix.match(/"sessionId":"([^"]+)"/)?.[1] ?? prefix.match(/"session_id":"([^"]+)"/)?.[1];
      if (timestamp && sessionId) counter.add(timestamp, sessionId);
    });
  }
  return availableProvider("claude-code", "Local Claude Code session event timestamps", counter.days());
}

export function exportCursor(databasePath) {
  void databasePath;
  return availableProvider("cursor", "Cursor AI Line Edits dashboard (aggregate export not configured)", []);
}

export async function exportLocalActivity({ codexRoot, codexDatabase, claudeRoot, cursorDatabase } = {}) {
  const profile = homedir();
  const configuredCodexRoot = codexRoot ?? process.env.CODEX_ACTIVITY_ROOT ?? path.join(profile, ".codex", "sessions");
  const providers = {
    codex: codexDatabase
      ? exportCodexDatabase(codexDatabase)
      : await exportCodex(configuredCodexRoot),
    cursor: exportCursor(cursorDatabase ?? process.env.CURSOR_ACTIVITY_DB ?? path.join(profile, ".cursor", "ai-tracking", "ai-code-tracking.db")),
    "claude-code": await exportClaude(claudeRoot ?? process.env.CLAUDE_ACTIVITY_ROOT ?? path.join(profile, ".claude", "projects")),
  };
  return {
    schemaVersion: 2,
    privacyVersion: "aggregate-v2",
    timeZone: TIME_ZONE,
    generatedAt: new Date().toISOString(),
    providers,
  };
}
