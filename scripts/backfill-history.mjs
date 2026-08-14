import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { exportClaude } from "./local-exporter.mjs";
import {
  buildHistoryBackfill,
  DailyIdentitySets,
  DailyTally,
  createDayBucketer,
  mergeHistoryBackfill,
  validateHistoryBackfill,
} from "./history-backfill-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(`History backfill: ${message}`);
}

function parseArguments(argv) {
  const options = {
    stateDb: path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), "Cursor", "User", "globalStorage", "state.vscdb"),
    trackingDb: path.join(homedir(), ".cursor", "ai-tracking", "ai-code-tracking.db"),
    claudeRoot: path.join(homedir(), ".claude", "projects"),
    out: path.join(ROOT, "data", "history-backfill.json"),
    approximateLines: false,
  };
  const flags = { "--state-db": "stateDb", "--tracking-db": "trackingDb", "--claude-root": "claudeRoot", "--out": "out" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--approximate-lines") {
      options.approximateLines = true;
    } else if (flags[flag]) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
      options[flags[flag]] = path.resolve(value);
      index += 1;
    } else {
      fail(`unknown flag ${flag}`);
    }
  }
  return options;
}

function openSqliteReadOnly(file) {
  try {
    return { database: new DatabaseSync(file, { readOnly: true }), cleanup: () => {} };
  } catch {
    const temporary = mkdtempSync(path.join(tmpdir(), "activity-backfill-"));
    for (const suffix of ["", "-wal", "-shm"]) {
      if (existsSync(`${file}${suffix}`)) copyFileSync(`${file}${suffix}`, path.join(temporary, `${path.basename(file)}${suffix}`));
    }
    const database = new DatabaseSync(path.join(temporary, path.basename(file)), { readOnly: true });
    return { database, cleanup: () => rmSync(temporary, { recursive: true, force: true }) };
  }
}

function epochToIso(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const milliseconds = number < 10_000_000_000 ? number * 1000 : number;
  const result = new Date(milliseconds);
  return Number.isNaN(result.valueOf()) ? null : result.toISOString();
}

function timestampToIso(value) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return epochToIso(value);
}

function hasTable(database, name) {
  return database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").all(name).length > 0;
}

function collectCursorState(stateDb, sessions) {
  if (!existsSync(stateDb)) {
    process.stderr.write(`History backfill: Cursor state database not found at ${stateDb}; skipping conversation history\n`);
    return;
  }
  const { database, cleanup } = openSqliteReadOnly(stateDb);
  try {
    if (hasTable(database, "cursorDiskKV")) {
      // JSON1 extracts the timestamp inside SQLite so bubble payloads (prompts, code, paths)
      // never cross into this process; only a 36-char id and a timestamp stream out.
      const bubbles = database.prepare("SELECT substr(key, 10, 36) AS composerId, json_extract(value, '$.createdAt') AS createdAt FROM cursorDiskKV WHERE key GLOB 'bubbleId:*'");
      for (const row of bubbles.iterate()) {
        const timestamp = timestampToIso(row.createdAt);
        if (timestamp) sessions.add(timestamp, String(row.composerId));
      }
    }
    if (hasTable(database, "composerHeaders")) {
      for (const row of database.prepare("SELECT composerId, createdAt FROM composerHeaders WHERE composerId IS NOT NULL").all()) {
        const timestamp = epochToIso(row.createdAt);
        if (timestamp) sessions.add(timestamp, String(row.composerId));
      }
    }
  } finally {
    database.close();
    cleanup();
  }
}

function collectCursorTracking(trackingDb, sessions, lines) {
  if (!existsSync(trackingDb)) {
    process.stderr.write(`History backfill: Cursor tracking database not found at ${trackingDb}; skipping line history\n`);
    return;
  }
  const { database, cleanup } = openSqliteReadOnly(trackingDb);
  try {
    if (!hasTable(database, "ai_code_hashes")) return;
    const columns = new Set(database.prepare("PRAGMA table_info(ai_code_hashes)").all().map((column) => String(column.name)));
    const timeColumn = columns.has("timestamp") ? "timestamp" : columns.has("createdAt") ? "createdAt" : null;
    if (!columns.has("conversationId") || !timeColumn) return;
    for (const row of database.prepare(`SELECT conversationId, ${timeColumn} AS observedAt FROM ai_code_hashes WHERE conversationId IS NOT NULL`).iterate()) {
      const timestamp = epochToIso(row.observedAt);
      if (!timestamp) continue;
      sessions.add(timestamp, String(row.conversationId));
      lines.add(timestamp, 1);
    }
  } finally {
    database.close();
    cleanup();
  }
}

function collectApproximateLines(stateDb, exactLineDays) {
  // Attributes each conversation's lifetime line total to its last-updated day. Lump-sum
  // attribution paints false single-day spikes, so this runs only behind --approximate-lines
  // and only for days strictly before exact per-day tracking begins.
  const exactStart = exactLineDays[0]?.date ?? "9999-12-31";
  const bucket = createDayBucketer();
  const tally = new DailyTally();
  if (!existsSync(stateDb)) return [];
  const { database, cleanup } = openSqliteReadOnly(stateDb);
  try {
    if (!hasTable(database, "composerHeaders")) return [];
    const rows = database.prepare("SELECT lastUpdatedAt, json_extract(value, '$.totalLinesAdded') AS added, json_extract(value, '$.totalLinesRemoved') AS removed FROM composerHeaders").all();
    for (const row of rows) {
      const timestamp = epochToIso(row.lastUpdatedAt);
      const total = (Number.isInteger(row.added) ? row.added : 0) + (Number.isInteger(row.removed) ? row.removed : 0);
      if (!timestamp || total <= 0) continue;
      const date = bucket(timestamp);
      if (date && date < exactStart) tally.add(timestamp, total);
    }
    return tally.days();
  } finally {
    database.close();
    cleanup();
  }
}

function summarize(label, days) {
  if (!days.length) return `${label}: no days`;
  const total = days.reduce((sum, day) => sum + day.value, 0);
  return `${label}: ${days.length} days, ${days[0].date} -> ${days.at(-1).date}, total ${total}`;
}

async function run(argv) {
  const options = parseArguments(argv);
  const sessions = new DailyIdentitySets();
  const lines = new DailyTally();
  collectCursorState(options.stateDb, sessions);
  collectCursorTracking(options.trackingDb, sessions, lines);
  let cursorLineDays = lines.days();
  if (options.approximateLines) {
    cursorLineDays = [...collectApproximateLines(options.stateDb, cursorLineDays), ...cursorLineDays].sort((left, right) => left.date.localeCompare(right.date));
  }
  const claude = await exportClaude(options.claudeRoot);
  let backfill = buildHistoryBackfill({
    cursorSessionDays: sessions.days(),
    cursorLineDays,
    claudeSessionDays: claude.metrics.activeSessions.days,
    approximateLines: options.approximateLines,
  });
  if (existsSync(options.out)) {
    const previous = validateHistoryBackfill(JSON.parse(await readFile(options.out, "utf8")));
    backfill = mergeHistoryBackfill(previous, backfill);
  }
  await mkdir(path.dirname(options.out), { recursive: true });
  const temporary = `${options.out}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(backfill, null, 2)}\n`, "utf8");
  await rename(temporary, options.out);
  return {
    out: options.out,
    cursorSessions: summarize("cursor activeSessions", backfill.providers.cursor.activeSessions),
    cursorLines: summarize("cursor appliedLineChanges", backfill.providers.cursor.appliedLineChanges),
    claudeSessions: summarize("claude-code activeSessions", backfill.providers["claude-code"].activeSessions),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

export { collectApproximateLines, openSqliteReadOnly, run };
