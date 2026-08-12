import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assembleSnapshot,
  dateInTimeZone,
  enumerateDates,
  METRICS,
  PROVIDERS,
  TIME_ZONE,
  unavailableProvider,
  validateRawProvider,
} from "./activity-core.mjs";

const ROOT = process.cwd();
const fixtureMode = process.argv.includes("--fixtures");
const isProduction = process.env.NODE_ENV === "production" || process.env.CI === "true";
if (fixtureMode && isProduction) throw new Error("Fixture mode is forbidden in production and CI builds");

function rangeForBuild() {
  const today = dateInTimeZone(new Date());
  const endYear = Number(today.slice(0, 4));
  return { start: `${endYear - 1}-01-01`, end: today };
}

function providerFromDays(provider, source, days, generatedAt = new Date().toISOString()) {
  const sorted = days.filter((day) => Number.isInteger(day.value) && day.value >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const result = {
    status: sorted.length ? "available" : "unavailable",
    metric: METRICS[provider],
    source,
    coverage: sorted.length ? { start: sorted[0].date, end: sorted.at(-1).date } : { start: null, end: null },
    lastSyncedAt: sorted.length ? generatedAt : null,
    days: sorted,
  };
  validateRawProvider(provider, result);
  return result;
}

function fixtureProviders(start, end) {
  const dates = enumerateDates(start, end);
  return Object.fromEntries(PROVIDERS.map((provider, providerIndex) => [provider, providerFromDays(
    provider,
    "Synthetic local development fixture",
    dates.map((date, index) => ({ date, value: index % (7 + providerIndex) === 0 ? providerIndex + 1 : 0 })),
  )]));
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function fetchGitHubContributions(username, start, end) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required to refresh GitHub contribution data");
  const days = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    const from = `${year}-01-01T00:00:00Z`;
    const toDate = year === Number(end.slice(0, 4)) ? end : `${year}-12-31`;
    const to = `${toDate}T23:59:59Z`;
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "joshua-nguyen-activity-exporter" },
      body: JSON.stringify({
        query: "query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}",
        variables: { login: username, from, to },
      }),
    });
    if (!response.ok) throw new Error(`GitHub contribution fetch failed with HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(`GitHub contribution fetch failed: ${payload.errors[0].message}`);
    const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!Array.isArray(weeks)) throw new Error("GitHub contribution response was malformed");
    for (const week of weeks) for (const day of week.contributionDays ?? []) {
      if (day.date >= start && day.date <= end) days.push({ date: day.date, value: day.contributionCount });
    }
  }
  return providerFromDays("github", "GitHub public contribution calendar", days);
}

async function getGitHubProvider(start, end) {
  const cacheFile = path.join(ROOT, "data", "github-activity.json");
  if (process.env.GITHUB_TOKEN) {
    const provider = await fetchGitHubContributions(process.env.GITHUB_USERNAME ?? "JoshuaNguyen123", start, end);
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, `${JSON.stringify(provider, null, 2)}\n`, "utf8");
    return provider;
  }
  if (!existsSync(cacheFile)) return unavailableProvider("github", "GitHub public contribution calendar");
  const provider = await loadJson(cacheFile);
  validateRawProvider("github", provider);
  return provider;
}

async function getLocalProviders() {
  const file = path.join(ROOT, "data", "local-activity.json");
  if (!existsSync(file)) return {
    codex: unavailableProvider("codex", "Local Codex log database (timestamp and thread_id only)"),
    cursor: unavailableProvider("cursor", "Local Cursor AI tracking database"),
    "claude-code": unavailableProvider("claude-code", "Local Claude Code session event timestamps"),
  };
  const value = await loadJson(file);
  const topKeys = Object.keys(value).sort().join(",");
  if (topKeys !== ["generatedAt", "privacyVersion", "providers", "schemaVersion", "timeZone"].sort().join(",")) throw new Error("Local activity snapshot contains unexpected properties");
  if (value.schemaVersion !== 1 || value.privacyVersion !== "aggregate-v1" || value.timeZone !== TIME_ZONE) throw new Error("Local activity snapshot schema is invalid");
  for (const provider of ["codex", "cursor", "claude-code"]) validateRawProvider(provider, value.providers[provider]);
  return value.providers;
}

const { start, end } = rangeForBuild();
const providers = fixtureMode
  ? fixtureProviders(start, end)
  : { github: await getGitHubProvider(start, end), ...await getLocalProviders() };
const snapshot = assembleSnapshot(providers, { start, end, mode: fixtureMode ? "fixture" : "observed" });
const output = path.join(ROOT, "public", "data", "activity.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Prepared ${snapshot.mode} activity snapshot for ${start} through ${end}`);
