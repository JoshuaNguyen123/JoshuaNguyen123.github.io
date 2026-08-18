import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dateInTimeZone, TIME_ZONE } from "./activity-core.mjs";
import {
  buildHistoryBackfill,
  mergeHistoryBackfill,
  validateHistoryBackfill,
} from "./history-backfill-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const CURSOR_USAGE_HEADERS = [
  "Date",
  "Cloud Agent ID",
  "Automation ID",
  "Kind",
  "Model",
  "Max Mode",
  "Input (w/ Cache Write)",
  "Input (w/o Cache Write)",
  "Cache Read",
  "Output Tokens",
  "Total Tokens",
  "Cost",
];

function fail(message) {
  throw new Error(`Cursor usage import: ${message}`);
}

function parseArguments(argv) {
  const options = { input: null, out: path.join(ROOT, "data", "history-backfill.json") };
  const flags = { "--input": "input", "--out": "out" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const key = flags[flag];
    if (!key) fail(`unknown flag ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
    options[key] = path.resolve(value);
    index += 1;
  }
  if (!options.input) fail("--input is required");
  return options;
}

export function parseCsv(text) {
  if (typeof text !== "string" || !text.length) fail("input is empty");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) fail("input contains an unterminated quoted field");
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function nonnegativeInteger(value, label, rowNumber) {
  if (value === "") return 0;
  if (!/^(0|[1-9]\d*)$/.test(value)) fail(`row ${rowNumber} has invalid ${label}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail(`row ${rowNumber} has unsafe ${label}`);
  return parsed;
}

function validCost(value, rowNumber) {
  if (!value.trim()) fail(`row ${rowNumber} has invalid Cost`);
}

export function reduceCursorUsageCsv(text, { now = new Date() } = {}) {
  const rows = parseCsv(text);
  const headers = rows.shift();
  if (!headers || headers.length !== CURSOR_USAGE_HEADERS.length || headers.some((header, index) => header !== CURSOR_USAGE_HEADERS[index])) {
    fail(`headers must be exactly: ${CURSOR_USAGE_HEADERS.join(", ")}`);
  }
  if (!rows.length) fail("input has no usage rows");
  const seenRows = new Set();
  const dates = new Set();
  let firstTimestamp = null;
  let lastTimestamp = null;
  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];
    if (row.length !== CURSOR_USAGE_HEADERS.length) fail(`row ${rowNumber} has ${row.length} columns instead of ${CURSOR_USAGE_HEADERS.length}`);
    const fingerprint = JSON.stringify(row);
    if (seenRows.has(fingerprint)) fail(`row ${rowNumber} is an exact duplicate`);
    seenRows.add(fingerprint);
    const timestamp = new Date(row[0]);
    if (Number.isNaN(timestamp.valueOf())) fail(`row ${rowNumber} has invalid Date`);
    if (timestamp.getTime() > now.getTime() + 5 * 60_000) fail(`row ${rowNumber} has a future Date`);
    if (!row[3] || !row[4] || !row[5]) fail(`row ${rowNumber} is missing Kind, Model, or Max Mode`);
    const inputWithCacheWrite = nonnegativeInteger(row[6], "Input (w/ Cache Write)", rowNumber);
    const inputWithoutCacheWrite = nonnegativeInteger(row[7], "Input (w/o Cache Write)", rowNumber);
    const cacheRead = nonnegativeInteger(row[8], "Cache Read", rowNumber);
    const outputTokens = nonnegativeInteger(row[9], "Output Tokens", rowNumber);
    const totalTokens = nonnegativeInteger(row[10], "Total Tokens", rowNumber);
    if (inputWithCacheWrite + inputWithoutCacheWrite + cacheRead + outputTokens !== totalTokens) fail(`row ${rowNumber} has inconsistent Total Tokens`);
    validCost(row[11], rowNumber);
    dates.add(dateInTimeZone(timestamp, TIME_ZONE));
    if (!firstTimestamp || timestamp < firstTimestamp) firstTimestamp = timestamp;
    if (!lastTimestamp || timestamp > lastTimestamp) lastTimestamp = timestamp;
  }
  const usagePresenceDays = [...dates].sort().map((date) => ({ date, value: 1 }));
  return {
    rowCount: rows.length,
    coverage: { start: usagePresenceDays[0].date, end: usagePresenceDays.at(-1).date },
    firstTimestamp: firstTimestamp.toISOString(),
    lastTimestamp: lastTimestamp.toISOString(),
    usagePresenceDays,
  };
}

export async function run(argv) {
  const options = parseArguments(argv);
  const reduced = reduceCursorUsageCsv(await readFile(options.input, "utf8"));
  const incoming = buildHistoryBackfill({
    cursorSessionDays: [],
    cursorUsagePresenceDays: reduced.usagePresenceDays,
    cursorLineDays: [],
    claudeSessionDays: [],
  });
  const previous = existsSync(options.out)
    ? validateHistoryBackfill(JSON.parse(await readFile(options.out, "utf8")))
    : null;
  const previousDates = new Set(previous?.providers.cursor.usagePresence.map((day) => day.date) ?? []);
  const merged = previous ? mergeHistoryBackfill(previous, incoming) : incoming;
  await mkdir(path.dirname(options.out), { recursive: true });
  const temporary = `${options.out}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(temporary, options.out);
  return {
    out: options.out,
    rowsValidated: reduced.rowCount,
    observedDays: reduced.usagePresenceDays.length,
    addedDays: reduced.usagePresenceDays.filter((day) => !previousDates.has(day.date)).length,
    coverage: reduced.coverage,
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
