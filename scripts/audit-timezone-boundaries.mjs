// Read-only diagnostic for timezone-boundary misattribution.
//
// Production days are write-once and living-local (home base America/Denver).
// This script does not rewrite anything. It answers: if those raw timestamps
// were *re-bucketed* in a different zone, which days would move, and what
// would that do to the streak? Denver is the home comparison zone.
//
// It re-reads the original local sources, which still carry raw event
// timestamps, because the committed exports keep bare dates only. It writes
// nothing and prints only dates and counts -- never a path, identity, prompt,
// or file name -- so it is safe to run and safe to paste.
import { createReadStream, existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { addDays, TIME_ZONE } from "./activity-core.mjs";

const MACHINE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Home first, then the trip zone and whatever this machine is on.
const ZONES = [...new Set(["America/Denver", TIME_ZONE, "America/Los_Angeles", MACHINE_ZONE, "UTC"])];
const BOUNDARY_MINUTES = 90;

const args = new Set(process.argv.slice(2));
const asNumber = (flag, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`${flag}=`));
  const parsed = hit ? Number(hit.slice(flag.length + 1)) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};
const sinceDays = args.has("--all") ? Number.POSITIVE_INFINITY : asNumber("--days", 120);
const sinceMs = Number.isFinite(sinceDays) ? Date.now() - sinceDays * 86_400_000 : 0;

async function listJsonlFiles(root, { byMtime = true } = {}) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl")).map((e) => path.join(e.parentPath, e.name));
  if (!byMtime || !Number.isFinite(sinceDays)) return files;
  // These logs are append-only, so a file last written before the window opened
  // cannot hold an event inside it. Skipping those turns a full read of every
  // retained transcript into a read of the recent ones.
  const kept = [];
  for (const file of files) {
    try {
      if ((await stat(file)).mtimeMs >= sinceMs) kept.push(file);
    } catch { /* vanished mid-scan; nothing to audit */ }
  }
  return kept;
}

// Mirrors local-exporter.mjs's streaming prefix read so the audit sees exactly
// the events the exporter sees.
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

/**
 * One event: the instant it happened and the identity counted that day.
 *
 * A session writes thousands of lines per minute and only distinct identities
 * per day are ever counted, so collapsing to one event per identity-minute is
 * lossless for every question this script asks -- and it is the difference
 * between bucketing millions of events and bucketing thousands.
 */
function pushEvent(events, seen, timestamp, identity) {
  if (!timestamp || !identity) return;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed) || parsed < sinceMs) return;
  const minute = Math.floor(parsed / 60_000);
  const key = `${identity}|${minute}`;
  if (seen.has(key)) return;
  seen.add(key);
  events.push({ at: parsed, identity });
}

// Intl.DateTimeFormat construction dominates otherwise: one formatter per zone,
// reused for every event.
const formatters = new Map();
function dayIn(at, zone) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(zone, formatter);
  }
  const parts = formatter.formatToParts(new Date(at));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function collectCodex(root) {
  const events = [];
  const seen = new Set();
  // Codex stores sessions under sessions/YYYY/MM/DD/, so the path states the
  // day the session began. That beats mtime here: file sync can touch an old
  // transcript and drag gigabytes of April back into a 30-day window. A session
  // can run past midnight, so keep the day before the window too.
  const earliest = Number.isFinite(sinceDays) ? dayIn(sinceMs, TIME_ZONE) : null;
  const cutoff = earliest ? addDays(earliest, -1) : null;
  let scanned = 0;
  for (const file of await listJsonlFiles(root, { byMtime: false })) {
    const stamped = /[\\/](\d{4})[\\/](\d{2})[\\/](\d{2})[\\/]/.exec(file);
    if (cutoff && stamped && `${stamped[1]}-${stamped[2]}-${stamped[3]}` < cutoff) continue;
    scanned += 1;
    const identity = path.basename(file, ".jsonl");
    await readLinePrefixes(file, (prefix) => {
      pushEvent(events, seen, prefix.match(/"timestamp":"([^"]+)"/)?.[1], identity);
    }, 512);
  }
  process.stderr.write(`  codex: read ${scanned} session file(s)\n`);
  return events;
}

async function collectClaude(root) {
  const events = [];
  const seen = new Set();
  for (const file of await listJsonlFiles(root)) {
    await readLinePrefixes(file, (prefix) => {
      const timestamp = prefix.match(/"timestamp":"([^"]+)"/)?.[1];
      const session = prefix.match(/"sessionId":"([^"]+)"/)?.[1] ?? prefix.match(/"session_id":"([^"]+)"/)?.[1];
      pushEvent(events, seen, timestamp, session);
    });
  }
  return events;
}

function collectCursor(databasePath) {
  const events = [];
  const seen = new Set();
  if (!existsSync(databasePath)) return events;
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_code_hashes'").all();
    if (!tables.length) return events;
    const columns = new Set(database.prepare("PRAGMA table_info(ai_code_hashes)").all().map((c) => String(c.name)));
    const timeColumn = columns.has("timestamp") ? "timestamp" : columns.has("createdAt") ? "createdAt" : null;
    if (!columns.has("conversationId") || !timeColumn) return events;
    const rows = database.prepare(`SELECT conversationId, ${timeColumn} AS observedAt FROM ai_code_hashes WHERE conversationId IS NOT NULL`).all();
    for (const row of rows) {
      const raw = Number(row.observedAt);
      if (!Number.isFinite(raw) || raw <= 0) continue;
      const milliseconds = raw < 10_000_000_000 ? raw * 1000 : raw;
      pushEvent(events, seen, new Date(milliseconds).toISOString(), String(row.conversationId));
    }
  } finally {
    database.close();
  }
  return events;
}

/** Distinct identities per calendar day, bucketed in `zone`. */
function bucket(events, zone) {
  const byDate = new Map();
  for (const event of events) {
    const date = dayIn(event.at, zone);
    if (!byDate.has(date)) byDate.set(date, new Set());
    byDate.get(date).add(event.identity);
  }
  return new Map([...byDate.entries()].map(([date, set]) => [date, set.size]));
}

// Same semantics as lib/activity/streaks.ts, over the same date arithmetic.
function longestStreak(dates) {
  const sorted = [...new Set(dates)].sort();
  let longest = 0;
  let current = 0;
  let previous;
  for (const date of sorted) {
    current = previous && addDays(previous, 1) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function currentStreak(dates, endDate) {
  const set = new Set(dates);
  let cursor = endDate;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function activeDates(counts) {
  return [...counts.entries()].filter(([, value]) => value > 0).map(([date]) => date);
}

/** Minutes from the nearest local midnight, in `zone`. */
function minutesFromMidnight(at, zone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const minutes = get("hour") * 60 + get("minute");
  return Math.min(minutes, 1440 - minutes);
}

const pad = (value, width) => String(value).padEnd(width);
const heading = (text) => console.log(`\n${text}\n${"-".repeat(text.length)}`);

const profile = homedir();
process.stderr.write(`scanning local sources (window: ${Number.isFinite(sinceDays) ? `${sinceDays}d` : "all"})...\n`);
const sources = {
  codex: await collectCodex(process.env.CODEX_ACTIVITY_ROOT ?? path.join(profile, ".codex", "sessions")),
  cursor: collectCursor(process.env.CURSOR_ACTIVITY_DB ?? path.join(profile, ".cursor", "ai-tracking", "ai-code-tracking.db")),
  "claude-code": await collectClaude(process.env.CLAUDE_ACTIVITY_ROOT ?? path.join(profile, ".claude", "projects")),
};

console.log("Timezone boundary audit (read-only; nothing is written)");
console.log(`Pinned zone      : ${TIME_ZONE}`);
console.log(`This machine     : ${MACHINE_ZONE}`);
console.log(`Compared zones   : ${ZONES.join(", ")}`);
console.log(`Window           : ${Number.isFinite(sinceDays) ? `last ${sinceDays} days (--all for everything)` : "all retained history"}`);
console.log("");

const buckets = {};
for (const [provider, events] of Object.entries(sources)) {
  buckets[provider] = Object.fromEntries(ZONES.map((zone) => [zone, bucket(events, zone)]));
  console.log(`${pad(provider, 12)} ${String(events.length).padStart(7)} raw events`);
}

// 1. Which dates move, and by how much.
heading("1. Dates whose totals change if the zone changes");
let anyMoved = false;
for (const provider of Object.keys(sources)) {
  const base = buckets[provider][TIME_ZONE];
  for (const zone of ZONES) {
    if (zone === TIME_ZONE) continue;
    const other = buckets[provider][zone];
    const dates = [...new Set([...base.keys(), ...other.keys()])].sort();
    const moved = dates.filter((date) => (base.get(date) ?? 0) !== (other.get(date) ?? 0));
    if (!moved.length) continue;
    anyMoved = true;
    console.log(`\n${provider}  ${TIME_ZONE} -> ${zone}   (${moved.length} date${moved.length === 1 ? "" : "s"} differ)`);
    console.log(`  ${pad("date", 12)} ${pad("pinned", 8)} ${pad(zone.split("/").pop(), 10)} delta`);
    for (const date of moved) {
      const from = base.get(date) ?? 0;
      const to = other.get(date) ?? 0;
      const flag = to === 0 ? "  <-- would empty this day" : from === 0 ? "  <-- new active day" : "";
      console.log(`  ${pad(date, 12)} ${pad(from, 8)} ${pad(to, 10)} ${to - from > 0 ? "+" : ""}${to - from}${flag}`);
    }
  }
}
if (!anyMoved) console.log("No date totals change under any compared zone.");

// 2. Streaks -- the reason this matters.
heading("2. Streak impact");
const today = dayIn(Date.now(), TIME_ZONE);
console.log(`  ${pad("provider", 12)} ${pad("zone", 24)} ${pad("current", 9)} longest`);
for (const provider of Object.keys(sources)) {
  for (const zone of ZONES) {
    const dates = activeDates(buckets[provider][zone]);
    const end = dayIn(Date.now(), zone);
    const label = zone + (zone === TIME_ZONE ? " (pinned)" : "");
    console.log(`  ${pad(provider, 12)} ${pad(label, 24)} ${pad(currentStreak(dates, end), 9)} ${longestStreak(dates)}`);
  }
}
// The site's streak comes from Build Index days with value > 0, and the Build
// Index averages ALL FOUR providers -- GitHub included. Leaving GitHub out
// undercounts the streak badly, because GitHub is active on plenty of days no
// local tool recorded. GitHub is bucketed server-side by the account's profile
// zone and cannot be re-bucketed here, so the same GitHub days are contributed
// to every zone.
const githubActive = new Set();
for (const file of ["public/data/activity.json", "data/github-activity.json"]) {
  const resolved = path.resolve(file);
  if (!existsSync(resolved)) continue;
  try {
    const parsed = JSON.parse(await readFile(resolved, "utf8"));
    const days = parsed.providers?.github?.metrics?.contributions?.days
      ?? parsed.metrics?.contributions?.days
      ?? [];
    for (const day of days) if (day?.value > 0 && typeof day.date === "string") githubActive.add(day.date);
  } catch { /* a damaged cache simply contributes nothing */ }
}
const union = (zone) => new Set([
  ...Object.keys(sources).flatMap((p) => activeDates(buckets[p][zone])),
  ...githubActive,
]);
console.log("\n  Any-provider streak (a day counts if any tool was active):");
for (const zone of ZONES) {
  const dates = [...union(zone)];
  const end = dayIn(Date.now(), zone);
  const label = zone + (zone === TIME_ZONE ? " (pinned)" : "");
  console.log(`  ${pad(label, 24)} current=${pad(currentStreak(dates, end), 5)} longest=${longestStreak(dates)}`);
}
console.log(`\n  (today in ${TIME_ZONE} is ${today})`);

// 2b. The recent calendar, so a broken streak has a visible cause.
heading("2b. Recent day-by-day (any provider active)");
{
  const days = 30;
  const end = dayIn(Date.now(), TIME_ZONE);
  const rows = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) rows.push(addDays(end, -offset));
  const marks = ZONES.map((zone) => {
    const active = union(zone);
    return { zone, active };
  });
  console.log(`  ${pad("date", 12)} ${pad("day", 4)} ${marks.map((m) => pad(m.zone.split("/").pop().slice(0, 11), 12)).join("")}`);
  for (const date of rows) {
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];
    const cells = marks.map((m) => pad(m.active.has(date) ? "active" : "-- GAP --", 12)).join("");
    console.log(`  ${pad(date, 12)} ${pad(weekday, 4)} ${cells}`);
  }
  console.log("\n  A GAP is what ends a current streak: getCurrentStreak walks back from today");
  console.log("  and stops at the first one.");
}

// 3. Days whose entire activity sits in the boundary window.
heading(`3. Days at risk: all activity within ${BOUNDARY_MINUTES} min of midnight`);
let anyRisk = false;
for (const [provider, events] of Object.entries(sources)) {
  const byDate = new Map();
  for (const event of events) {
    const date = dayIn(event.at, TIME_ZONE);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(event);
  }
  const risky = [...byDate.entries()]
    .filter(([, list]) => list.every((e) => minutesFromMidnight(e.at, TIME_ZONE) <= BOUNDARY_MINUTES))
    .map(([date]) => date)
    .sort();
  if (!risky.length) continue;
  anyRisk = true;
  console.log(`\n${provider}: ${risky.length} day(s) that could move wholesale`);
  for (const date of risky) console.log(`  ${date}`);
}
if (!anyRisk) console.log("No day has all of its activity inside the boundary window.");

// 4. GitHub is bucketed server-side by the profile zone and cannot be re-bucketed here.
heading("4. GitHub vs local calendars");
const publishedPath = path.resolve("public/data/activity.json");
if (existsSync(publishedPath)) {
  const snapshot = JSON.parse(await readFile(publishedPath, "utf8"));
  // Only compare where both calendars actually have coverage. The local scan is
  // windowed, so comparing it against a full year of GitHub days would report
  // every out-of-window day as a disagreement and mean nothing.
  const windowStart = Number.isFinite(sinceDays) ? dayIn(sinceMs, TIME_ZONE) : "0000-01-01";
  const github = new Map((snapshot.providers?.github?.metrics?.contributions?.days ?? [])
    .filter((d) => d.date >= windowStart)
    .map((d) => [d.date, d.value]));
  const localActive = union(TIME_ZONE);
  const ghOnly = [...github.entries()].filter(([date, value]) => value > 0 && !localActive.has(date)).map(([date]) => date);
  const localOnly = [...localActive].filter((date) => date >= windowStart && github.has(date) && (github.get(date) ?? 0) === 0);
  console.log("GitHub buckets by your GitHub PROFILE timezone and cannot be re-bucketed from this repo.");
  console.log(`  compared over ${windowStart} onward, where both calendars have coverage`);
  console.log(`  days GitHub calls active but no local tool did : ${ghOnly.length}`);
  console.log(`  days a local tool was active but GitHub was 0  : ${localOnly.length}`);
  for (const date of [...new Set([...ghOnly, ...localOnly])].sort()) console.log(`  ${date}`);
} else {
  console.log("public/data/activity.json not present; skipped.");
}

heading("Reading this");
console.log("Section 1 lists every day a zone change would move. Anything not listed is unaffected.");
console.log("Section 2 is the one to check before approving a correction: it shows whether a fix");
console.log("lengthens or shortens a streak. A day marked 'would empty this day' in section 1 is");
console.log("how a streak breaks silently.");
