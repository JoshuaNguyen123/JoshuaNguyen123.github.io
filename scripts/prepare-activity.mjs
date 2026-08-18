import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  assembleSnapshot,
  createMetricSeries,
  dateInTimeZone,
  enumerateDates,
  METRICS,
  PRIVACY_VERSION,
  PROVIDERS,
  SCHEMA_VERSION,
  TIME_ZONE,
  unavailableProvider,
  upgradeProvider,
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

function fixtureProviders(start, end) {
  const dates = enumerateDates(start, end);
  return Object.fromEntries(PROVIDERS.map((provider, providerIndex) => {
    const metrics = Object.fromEntries(Object.keys(METRICS[provider]).map((metricId, metricIndex) => [
      metricId,
      createMetricSeries(
        provider,
        metricId,
        "Synthetic local development fixture",
        dates.map((date, index) => ({ date, value: index % (7 + providerIndex + metricIndex) === 0 ? providerIndex + metricIndex + 1 : 0 })),
      ),
    ]));
    return [provider, { metrics }];
  }));
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function githubToken() {
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();
  if (process.env.CI === "true") return null;
  const result = spawnSync("gh", ["auth", "token"], { encoding: "utf8", windowsHide: true });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

async function fetchGitHubContributions(username, start, end, token) {
  const days = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    const from = `${year}-01-01T00:00:00Z`;
    const toDate = year === Number(end.slice(0, 4)) ? end : `${year}-12-31`;
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "joshua-nguyen-activity-exporter" },
      body: JSON.stringify({
        query: "query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}",
        variables: { login: username, from, to: `${toDate}T23:59:59Z` },
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
  const provider = {
    metrics: {
      contributions: createMetricSeries("github", "contributions", "GitHub public contribution calendar", days),
    },
  };
  validateRawProvider("github", provider);
  return provider;
}

async function getGitHubProvider(start, end) {
  const cacheFile = path.join(ROOT, "data", "github-activity.json");
  const token = githubToken();
  if (token) {
    const provider = await fetchGitHubContributions(process.env.GITHUB_USERNAME ?? "JoshuaNguyen123", start, end, token);
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, `${JSON.stringify(provider, null, 2)}\n`, "utf8");
    return provider;
  }
  if (!existsSync(cacheFile)) return unavailableProvider("github");
  return upgradeProvider("github", await loadJson(cacheFile));
}

async function getLocalProviders() {
  const file = path.join(ROOT, "data", "local-activity.json");
  if (!existsSync(file)) return {
    codex: unavailableProvider("codex"),
    cursor: unavailableProvider("cursor"),
    "claude-code": unavailableProvider("claude-code"),
  };
  const value = await loadJson(file);
  const topKeys = Object.keys(value).sort().join(",");
  if (topKeys !== ["generatedAt", "privacyVersion", "providers", "schemaVersion", "timeZone"].sort().join(",")) throw new Error("Local activity snapshot contains unexpected properties");
  const supported = value.schemaVersion === 2 && value.privacyVersion === "aggregate-v2"
    || value.schemaVersion === 3 && value.privacyVersion === "aggregate-v3"
    || value.schemaVersion === 4 && value.privacyVersion === "aggregate-v4"
    || value.schemaVersion === SCHEMA_VERSION && value.privacyVersion === PRIVACY_VERSION;
  if (!supported || value.timeZone !== TIME_ZONE) throw new Error("Local activity snapshot schema is invalid");
  return Object.fromEntries(["codex", "cursor", "claude-code"].map((provider) => [provider, upgradeProvider(provider, value.providers[provider])]));
}

const { start, end } = rangeForBuild();
const providers = fixtureMode ? fixtureProviders(start, end) : { github: await getGitHubProvider(start, end), ...await getLocalProviders() };
const snapshot = assembleSnapshot(providers, { start, end, mode: fixtureMode ? "fixture" : "observed" });
const output = path.join(ROOT, "public", "data", "activity.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Prepared ${snapshot.mode} activity snapshot for ${start} through ${end}`);
