// Downloads Cursor dashboard usage CSV via the local state.vscdb access token
// (no manual cookie, no Admin API). Merges into data/history-backfill.json as
// binary usage-presence days only — never persists tokens, models, costs, or cookies.
//
// Requires Cursor signed in locally. Override DB path with CURSOR_STATE_DB_PATH.

import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { buildHistoryBackfill, mergeHistoryBackfill, validateHistoryBackfill } from "./history-backfill-core.mjs";
import { reduceCursorUsageCsv } from "./import-cursor-usage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CURSOR_EXPORT_URL = "https://cursor.com/api/dashboard/export-usage-events-csv";

function fail(message) {
  throw new Error(`Cursor usage download: ${message}`);
}

export function cursorStateDbPath(env = process.env) {
  if (env.CURSOR_STATE_DB_PATH?.trim()) return path.resolve(env.CURSOR_STATE_DB_PATH.trim());
  if (process.platform === "win32") {
    return path.join(
      env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"),
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb",
    );
  }
  return path.join(homedir(), ".config", "Cursor", "User", "globalStorage", "state.vscdb");
}

function openSqliteReadOnly(file) {
  try {
    return { database: new DatabaseSync(file, { readOnly: true }), cleanup: () => {} };
  } catch {
    const temporary = mkdtempSync(path.join(tmpdir(), "cursor-usage-db-"));
    for (const suffix of ["", "-wal", "-shm"]) {
      if (existsSync(`${file}${suffix}`)) {
        copyFileSync(`${file}${suffix}`, path.join(temporary, `${path.basename(file)}${suffix}`));
      }
    }
    const database = new DatabaseSync(path.join(temporary, path.basename(file)), { readOnly: true });
    return { database, cleanup: () => rmSync(temporary, { recursive: true, force: true }) };
  }
}

export function readCursorAccessToken(dbPath) {
  if (!existsSync(dbPath)) fail(`Cursor state DB not found: ${dbPath}`);
  const { database, cleanup } = openSqliteReadOnly(dbPath);
  try {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ItemTable'").all();
    if (!tables.length) fail("Cursor state DB has no ItemTable");
    const row = database.prepare("SELECT value FROM ItemTable WHERE key = ?").get("cursorAuth/accessToken");
    if (!row || row.value == null || row.value === "") {
      fail("Cursor access token not found (is Cursor signed in?)");
    }
    let value = String(row.value);
    try {
      const decoded = JSON.parse(value);
      if (typeof decoded === "string") value = decoded;
    } catch {
      // Plain string token.
    }
    if (!value.includes(".")) fail("Cursor access token is not a JWT");
    return value;
  } finally {
    database.close();
    cleanup();
  }
}

export function jwtPayload(token) {
  const parts = String(token).split(".");
  if (parts.length < 2) fail("invalid JWT");
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    fail("JWT payload is not valid JSON");
  }
}

export function buildCursorSessionCookie(token) {
  const payload = jwtPayload(token);
  const subject = payload?.sub;
  if (typeof subject !== "string" || !subject) fail("JWT is missing sub");
  const userId = subject.includes("|") ? subject.slice(subject.lastIndexOf("|") + 1) : subject;
  if (!userId) fail("JWT sub has an empty user id");
  return encodeURIComponent(`${userId}::${token}`);
}

export async function downloadCursorUsageCsv({
  env = process.env,
  fetchImpl = fetch,
  dbPath = cursorStateDbPath(env),
  readToken = readCursorAccessToken,
} = {}) {
  const token = readToken(dbPath);
  const cookie = buildCursorSessionCookie(token);
  const response = await fetchImpl(CURSOR_EXPORT_URL, {
    method: "GET",
    headers: {
      Cookie: `WorkosCursorSessionToken=${cookie}`,
      "User-Agent": "joshua-nguyen-cursor-usage-download/1.0",
      Accept: "text/csv,*/*",
    },
  });
  if (!response.ok) fail(`export endpoint returned HTTP ${response.status}`);
  const body = typeof response.text === "function" ? await response.text() : String(response.body ?? "");
  if (!body.trim()) fail("export endpoint returned an empty body");
  if (body.trimStart().startsWith("<")) {
    fail("export endpoint returned HTML instead of CSV; authentication likely failed");
  }
  return body;
}

function parseArguments(argv) {
  const options = { out: path.join(ROOT, "data", "history-backfill.json") };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("--out requires a value");
      options.out = path.resolve(value);
      index += 1;
    } else {
      fail(`unknown flag ${flag}`);
    }
  }
  return options;
}

export async function mergeCursorUsageCsv(csvText, { out, now = new Date() } = {}) {
  const reduced = reduceCursorUsageCsv(csvText, { now });
  const incoming = buildHistoryBackfill({
    cursorSessionDays: [],
    cursorUsagePresenceDays: reduced.usagePresenceDays,
    cursorLineDays: [],
    claudeSessionDays: [],
    generatedAt: now.toISOString(),
  });
  const previous = existsSync(out) ? validateHistoryBackfill(JSON.parse(await readFile(out, "utf8"))) : null;
  const previousDates = new Set(previous?.providers.cursor.usagePresence.map((day) => day.date) ?? []);
  const merged = previous ? mergeHistoryBackfill(previous, incoming) : incoming;
  await mkdir(path.dirname(out), { recursive: true });
  const temporary = `${out}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(temporary, out);
  return {
    out,
    rowsValidated: reduced.rowCount,
    observedDays: reduced.usagePresenceDays.length,
    addedDays: reduced.usagePresenceDays.filter((day) => !previousDates.has(day.date)).length,
    coverage: reduced.coverage,
  };
}

export async function run(argv = [], {
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
  downloadCsv = downloadCursorUsageCsv,
} = {}) {
  const options = parseArguments(argv);
  const csvText = await downloadCsv({ env, fetchImpl });
  const merged = await mergeCursorUsageCsv(csvText, { out: options.out, now });
  return { skipped: false, source: "dashboard-csv", ...merged };
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
