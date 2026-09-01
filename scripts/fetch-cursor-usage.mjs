// Pulls Cursor usage into data/history-backfill.json as calendar-day presence only.
// Primary: local Cursor auth (state.vscdb) → dashboard CSV. Optional fallback:
// CURSOR_ADMIN_API_KEY Admin API (Teams/Enterprise). Never writes emails, models,
// token counts, costs, or session tokens to disk.
//
// Soft-fails on build unless CURSOR_FETCH_STRICT=1.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dateInTimeZone, HOME_TIME_ZONE } from "./activity-core.mjs";
import { run as downloadAndMergeDashboardCsv } from "./download-cursor-usage.mjs";
import { buildHistoryBackfill, mergeHistoryBackfill, validateHistoryBackfill } from "./history-backfill-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "https://api.cursor.com";
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const PAGE_SIZE = 500;

function fail(message) {
  throw new Error(`Cursor usage fetch: ${message}`);
}

function parseArguments(argv) {
  const options = { days: DEFAULT_DAYS, out: path.join(ROOT, "data", "history-backfill.json") };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--days") {
      options.days = Number.parseInt(value, 10);
      if (!Number.isInteger(options.days) || options.days < 1 || options.days > MAX_DAYS) {
        fail(`--days must be 1-${MAX_DAYS}`);
      }
      index += 1;
    } else if (flag === "--out") {
      if (!value) fail("--out requires a value");
      options.out = path.resolve(value);
      index += 1;
    } else {
      fail(`unknown flag ${flag}`);
    }
  }
  return options;
}

async function postJson(endpoint, body, apiKey, fetchImpl) {
  const response = await fetchImpl(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) fail(`${endpoint} returned HTTP ${response.status}`);
  return response.json();
}

export async function fetchUsageEvents({ apiKey, startDate, endDate, fetchImpl = fetch }) {
  const events = [];
  for (let page = 1; ; page += 1) {
    const payload = await postJson(
      "/teams/filtered-usage-events",
      { startDate, endDate, page, pageSize: PAGE_SIZE },
      apiKey,
      fetchImpl,
    );
    const batch = Array.isArray(payload?.usageEvents) ? payload.usageEvents : [];
    events.push(...batch);
    const hasNext = payload?.pagination?.hasNextPage ?? batch.length === PAGE_SIZE;
    if (!hasNext || !batch.length) break;
    if (page > 50) fail("too many pages; refusing to loop");
  }
  return events;
}

export function reduceUsageEvents(events, { now = new Date(), timeZone = HOME_TIME_ZONE } = {}) {
  const dates = new Set();
  for (const event of events) {
    const raw = event?.timestamp;
    const timestamp = typeof raw === "number" ? new Date(raw) : new Date(Number.parseInt(String(raw), 10) || raw);
    if (Number.isNaN(timestamp.valueOf())) continue;
    if (timestamp.getTime() > now.getTime() + 5 * 60_000) continue;
    dates.add(dateInTimeZone(timestamp, timeZone));
  }
  return [...dates].sort().map((date) => ({ date, value: 1 }));
}

async function mergeAdminUsageEvents(events, { out, now }) {
  const usagePresenceDays = reduceUsageEvents(events, { now });
  if (!usagePresenceDays.length) {
    return { skipped: false, source: "admin-api", events: events.length, addedDays: 0, observedDays: 0 };
  }
  const incoming = buildHistoryBackfill({
    cursorSessionDays: [],
    cursorUsagePresenceDays: usagePresenceDays,
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
    skipped: false,
    source: "admin-api",
    out,
    events: events.length,
    observedDays: usagePresenceDays.length,
    addedDays: usagePresenceDays.filter((day) => !previousDates.has(day.date)).length,
    coverage: { start: usagePresenceDays[0].date, end: usagePresenceDays.at(-1).date },
  };
}

export async function run(argv, {
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
  downloadRun = downloadAndMergeDashboardCsv,
} = {}) {
  const options = parseArguments(argv);

  try {
    return await downloadRun(["--out", options.out], { env, fetchImpl, now });
  } catch (downloadError) {
    const apiKey = env.CURSOR_ADMIN_API_KEY?.trim();
    if (!apiKey) {
      return {
        skipped: true,
        reason: downloadError.message,
        fallback: "CURSOR_ADMIN_API_KEY is not set",
      };
    }
    process.stderr.write(`${downloadError.message}; falling back to Admin API\n`);
    const endDate = now.getTime();
    const startDate = endDate - options.days * 24 * 60 * 60 * 1000;
    const events = await fetchUsageEvents({ apiKey, startDate, endDate, fetchImpl });
    return mergeAdminUsageEvents(events, { out: options.out, now });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = process.env.CURSOR_FETCH_STRICT ? 1 : 0;
  }
}
