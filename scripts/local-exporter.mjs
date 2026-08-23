import { createReadStream, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  createMetricSeries,
  dateInTimeZone,
  SCHEMA_VERSION,
  PRIVACY_VERSION,
  TIME_ZONE,
  validateRawProvider,
} from "./activity-core.mjs";
import { mergeBackfillDays, validateHistoryBackfill } from "./history-backfill-core.mjs";

const CURSOR_LINES_SOURCE = "Local Cursor edit hooks and AI code tracking history";
const CURSOR_USAGE_SOURCE = "Cursor usage-event export (daily presence only)";
const DEFAULT_HISTORY_BACKFILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "history-backfill.json");

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
    if (!timestamp || !transientId || Number.isNaN(Date.parse(timestamp))) return;
    const cacheKey = timestamp.slice(0, 13);
    let date = this.#dateCache.get(cacheKey);
    if (!date) {
      date = dateInTimeZone(timestamp);
      this.#dateCache.set(cacheKey, date);
    }
    if (!this.#identities.has(date)) this.#identities.set(date, new Set());
    this.#identities.get(date).add(transientId);
  }

  days() {
    return [...this.#identities.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, identities]) => ({ date, value: identities.size }));
  }
}

function epochToIso(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const milliseconds = number < 10_000_000_000 ? number * 1000 : number;
  const result = new Date(milliseconds);
  return Number.isNaN(result.valueOf()) ? null : result.toISOString();
}

function providerWithMetric(provider, metricId, source, days) {
  const result = { metrics: { [metricId]: createMetricSeries(provider, metricId, source, days) } };
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
  return providerWithMetric("codex", "activeSessions", "Local Codex session event timestamps", counter.days());
}

export function exportCodexDatabase(databasePath) {
  if (!existsSync(databasePath)) return providerWithMetric("codex", "activeSessions", "Local Codex log database (timestamp and thread_id only)", []);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database.prepare(
      "SELECT MIN(ts) AS timestamp, thread_id FROM logs WHERE ts IS NOT NULL AND thread_id IS NOT NULL GROUP BY thread_id, date(ts, 'unixepoch', 'localtime')",
    ).all();
    const counter = new DailyIdentityCounter();
    for (const row of rows) counter.add(new Date(Number(row.timestamp) * 1000).toISOString(), String(row.thread_id));
    return providerWithMetric("codex", "activeSessions", "Local Codex log database (timestamp and thread_id only)", counter.days());
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
  return providerWithMetric("claude-code", "activeSessions", "Local Claude Code hooks and retained session timestamps", counter.days());
}

export function exportCursor(databasePath) {
  const activeSource = "Local Cursor hooks and retained conversation timestamps";
  const attemptedAt = new Date().toISOString();
  const counter = new DailyIdentityCounter();
  const lineTotals = new Map();
  const dateCache = new Map();
  const bucketDate = (timestamp) => {
    const cacheKey = timestamp.slice(0, 13);
    let date = dateCache.get(cacheKey);
    if (!date) {
      date = dateInTimeZone(timestamp);
      dateCache.set(cacheKey, date);
    }
    return date;
  };
  if (existsSync(databasePath)) {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_code_hashes'").all();
      if (tables.length) {
        const columns = new Set(database.prepare("PRAGMA table_info(ai_code_hashes)").all().map((column) => String(column.name)));
        const timeColumn = columns.has("timestamp") ? "timestamp" : columns.has("createdAt") ? "createdAt" : null;
        if (columns.has("conversationId") && timeColumn) {
          const rows = database.prepare(`SELECT conversationId, ${timeColumn} AS observedAt FROM ai_code_hashes WHERE conversationId IS NOT NULL`).all();
          for (const row of rows) {
            const timestamp = epochToIso(row.observedAt);
            if (!timestamp) continue;
            counter.add(timestamp, String(row.conversationId));
            const date = bucketDate(timestamp);
            lineTotals.set(date, (lineTotals.get(date) ?? 0) + 1);
          }
        }
      }
    } finally {
      database.close();
    }
  }
  const activeDays = counter.days();
  const lineDays = [...lineTotals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));
  const result = {
    metrics: {
      activeSessions: createMetricSeries("cursor", "activeSessions", activeSource, activeDays, { lastAttemptedAt: attemptedAt }),
      usagePresence: createMetricSeries("cursor", "usagePresence", CURSOR_USAGE_SOURCE, [], { lastAttemptedAt: attemptedAt }),
      appliedLineChanges: createMetricSeries("cursor", "appliedLineChanges", CURSOR_LINES_SOURCE, lineDays, { lastAttemptedAt: attemptedAt }),
    },
  };
  validateRawProvider("cursor", result);
  return result;
}

async function loadHistoryBackfill(file) {
  if (!existsSync(file)) return null;
  try {
    return validateHistoryBackfill(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    process.stderr.write(`Local activity export: ignoring history backfill file ${file}: ${error.message}\n`);
    return null;
  }
}

export function applyHistoryBackfill(providers, backfill) {
  if (!backfill) return providers;
  const merge = (provider, metricId, source, staticDays) => {
    const metric = providers[provider].metrics[metricId];
    providers[provider].metrics[metricId] = createMetricSeries(provider, metricId, source, mergeBackfillDays(staticDays, metric.days), {
      lastAttemptedAt: metric.lastAttemptedAt ?? undefined,
    });
  };
  merge("cursor", "activeSessions", "Local Cursor hooks and retained conversation timestamps", backfill.providers.cursor.activeSessions);
  merge("cursor", "usagePresence", CURSOR_USAGE_SOURCE, backfill.providers.cursor.usagePresence);
  merge("cursor", "appliedLineChanges", CURSOR_LINES_SOURCE, backfill.providers.cursor.appliedLineChanges);
  merge("claude-code", "activeSessions", "Local Claude Code hooks and retained session timestamps", backfill.providers["claude-code"].activeSessions);
  validateRawProvider("cursor", providers.cursor);
  validateRawProvider("claude-code", providers["claude-code"]);
  return providers;
}

export async function exportLocalActivity({ codexRoot, codexDatabase, claudeRoot, cursorDatabase, historyBackfill } = {}) {
  const profile = homedir();
  const configuredCodexRoot = codexRoot ?? process.env.CODEX_ACTIVITY_ROOT ?? path.join(profile, ".codex", "sessions");
  const providers = {
    codex: codexDatabase ? exportCodexDatabase(codexDatabase) : await exportCodex(configuredCodexRoot),
    cursor: exportCursor(cursorDatabase ?? process.env.CURSOR_ACTIVITY_DB ?? path.join(profile, ".cursor", "ai-tracking", "ai-code-tracking.db")),
    "claude-code": await exportClaude(claudeRoot ?? process.env.CLAUDE_ACTIVITY_ROOT ?? path.join(profile, ".claude", "projects")),
  };
  const backfill = await loadHistoryBackfill(historyBackfill ?? process.env.ACTIVITY_HISTORY_BACKFILL ?? DEFAULT_HISTORY_BACKFILL);
  applyHistoryBackfill(providers, backfill);
  return {
    schemaVersion: SCHEMA_VERSION,
    privacyVersion: PRIVACY_VERSION,
    timeZone: TIME_ZONE,
    generatedAt: new Date().toISOString(),
    providers,
  };
}
