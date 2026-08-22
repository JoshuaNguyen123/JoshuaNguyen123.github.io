// Pulls recent Cursor usage from the Cursor Admin API and merges it into
// data/history-backfill.json as usage-presence days, the same shape the CSV
// importer produces. Runs before every dashboard build; with no key it is a no-op.
//
// Requires CURSOR_ADMIN_API_KEY (Cursor dashboard -> Settings -> Admin API keys;
// the Admin API is a Teams/Enterprise feature). Only calendar-day presence is
// kept: no emails, models, token counts, or costs are written to disk.

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dateInTimeZone, TIME_ZONE } from "./activity-core.mjs";
import { buildHistoryBackfill, mergeHistoryBackfill, validateHistoryBackfill } from "./history-backfill-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "https://api.cursor.com";
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30; // Admin API limit per request
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
      if (!Number.isInteger(options.days) || options.days < 1 || options.days > MAX_DAYS) fail(`--days must be 1-${MAX_DAYS}`);
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

export function reduceUsageEvents(events, { now = new Date() } = {}) {
  const dates = new Set();
  for (const event of events) {
    const raw = event?.timestamp;
    const timestamp = typeof raw === "number" ? new Date(raw) : new Date(Number.parseInt(String(raw), 10) || raw);
    if (Number.isNaN(timestamp.valueOf())) continue;
    if (timestamp.getTime() > now.getTime() + 5 * 60_000) continue;
    dates.add(dateInTimeZone(timestamp, TIME_ZONE));
  }
  return [...dates].sort().map((date) => ({ date, value: 1 }));
}

export async function run(argv, { env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const options = parseArguments(argv);
  const apiKey = env.CURSOR_ADMIN_API_KEY?.trim();
  if (!apiKey) return { skipped: true, reason: "CURSOR_ADMIN_API_KEY is not set" };

  const endDate = now.getTime();
  const startDate = endDate - options.days * 24 * 60 * 60 * 1000;
  const events = await fetchUsageEvents({ apiKey, startDate, endDate, fetchImpl });
  const usagePresenceDays = reduceUsageEvents(events, { now });
  if (!usagePresenceDays.length) return { skipped: false, events: events.length, addedDays: 0, observedDays: 0 };

  const incoming = buildHistoryBackfill({
    cursorSessionDays: [],
    cursorUsagePresenceDays: usagePresenceDays,
    cursorLineDays: [],
    claudeSessionDays: [],
    generatedAt: now.toISOString(),
  });
  const previous = existsSync(options.out) ? validateHistoryBackfill(JSON.parse(await readFile(options.out, "utf8"))) : null;
  const previousDates = new Set(previous?.providers.cursor.usagePresence.map((day) => day.date) ?? []);
  const merged = previous ? mergeHistoryBackfill(previous, incoming) : incoming;

  await mkdir(path.dirname(options.out), { recursive: true });
  const temporary = `${options.out}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(temporary, options.out);

  return {
    skipped: false,
    out: options.out,
    events: events.length,
    observedDays: usagePresenceDays.length,
    addedDays: usagePresenceDays.filter((day) => !previousDates.has(day.date)).length,
    coverage: { start: usagePresenceDays[0].date, end: usagePresenceDays.at(-1).date },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    // A failed fetch must never break the site build; the committed backfill still stands.
    process.stderr.write(`${error.message}\n`);
    process.exitCode = process.env.CURSOR_FETCH_STRICT ? 1 : 0;
  }
}
