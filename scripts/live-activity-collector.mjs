import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  assembleSnapshot,
  createMetricSeries,
  dateInTimeZone,
  markProviderStale,
  rangeForBuild,
  TIME_ZONE,
  upgradeSnapshot,
  validateRawProvider,
  validateSnapshot,
} from "./activity-core.mjs";
import { run as downloadCursorUsage } from "./download-cursor-usage.mjs";
import { exportLocalActivity } from "./local-exporter.mjs";
import { consumeHookSpool, mergeHookLedger, snapshotsMatch } from "./live-activity-core.mjs";

const ROOT = process.cwd();
// Derived from the shared window so the live feed can never cover fewer years
// than the bundled snapshot the page ships with.
const START_DATE = rangeForBuild().start;

function fail(message) {
  throw new Error(`Live activity collector: ${message}`);
}

async function loadEnvFile() {
  const file = path.join(ROOT, ".env.live");
  if (!existsSync(file)) return;
  const contents = await readFile(file, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) fail(".env.live contains a malformed assignment");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function githubToken() {
  if (process.env.GITHUB_PUBLISH_TOKEN?.trim()) return process.env.GITHUB_PUBLISH_TOKEN.trim();
  const result = spawnSync("gh", ["auth", "token"], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || !result.stdout.trim()) fail("GitHub CLI is not authenticated and GITHUB_PUBLISH_TOKEN is not configured");
  return result.stdout.trim();
}

function configuration() {
  const branch = process.env.ACTIVITY_DATA_BRANCH?.trim() || "activity-data";
  const feedPath = process.env.ACTIVITY_DATA_PATH?.trim() || "activity.json";
  const repository = process.env.GITHUB_REPOSITORY?.trim() || "JoshuaNguyen123/JoshuaNguyen123.github.io";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail("GITHUB_REPOSITORY must be owner/repository");
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || !/^[A-Za-z0-9._/-]+$/.test(feedPath) || feedPath.startsWith("/")) fail("activity branch or path contains unsafe characters");
  return {
    repository,
    branch,
    feedPath,
    username: process.env.GITHUB_USERNAME?.trim() || "JoshuaNguyen123",
    token: githubToken(),
    activityHome: process.env.ENGINEERING_ACTIVITY_HOME ?? path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"), "EngineeringActivity"),
  };
}

async function githubRequest(config, endpoint, options = {}) {
  const url = `https://api.github.com/repos/${config.repository}${endpoint ? `/${endpoint}` : ""}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "joshua-nguyen-local-activity-collector/2.0",
      ...(options.headers ?? {}),
    },
  });
  if (response.status === 404 && options.allowMissing) return { response, body: null };
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) fail(`GitHub repository request ${endpoint.split("?")[0] || "metadata"} returned HTTP ${response.status}`);
  return { response, body };
}

async function readRemoteSnapshot(config) {
  const result = await githubRequest(config, `contents/${config.feedPath}?ref=${encodeURIComponent(config.branch)}`, { allowMissing: true });
  if (!result.body) return null;
  if (typeof result.body.content !== "string" || typeof result.body.sha !== "string") fail("activity-data branch contains a malformed feed file");
  try {
    const parsed = JSON.parse(Buffer.from(result.body.content.replace(/\n/g, ""), "base64").toString("utf8"));
    return { snapshot: upgradeSnapshot(parsed), sha: result.body.sha };
  } catch {
    fail("activity-data branch feed failed validation");
  }
}

async function ensureBranch(config) {
  const branch = await githubRequest(config, `git/ref/heads/${encodeURIComponent(config.branch)}`, { allowMissing: true });
  if (branch.body) return;
  const repository = await githubRequest(config, "");
  const defaultBranch = repository.body?.default_branch;
  if (typeof defaultBranch !== "string") fail("Could not identify the repository default branch");
  const base = await githubRequest(config, `git/ref/heads/${encodeURIComponent(defaultBranch)}`);
  const sha = base.body?.object?.sha;
  if (typeof sha !== "string") fail("Could not resolve the default branch commit");
  await githubRequest(config, "git/refs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${config.branch}`, sha }),
  });
}

async function publishSnapshot(config, snapshot, sha) {
  validateSnapshot(snapshot);
  await ensureBranch(config);
  const body = {
    message: `Update privacy-safe activity through ${snapshot.range.end}`,
    content: Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8").toString("base64"),
    branch: config.branch,
    ...(sha ? { sha } : {}),
  };
  await githubRequest(config, `contents/${config.feedPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function fetchGitHubProvider(config, start, end, now) {
  const days = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    const toDate = year === Number(end.slice(0, 4)) ? end : `${year}-12-31`;
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${config.token}`, "Content-Type": "application/json", "User-Agent": "joshua-nguyen-local-activity-collector/2.0" },
      body: JSON.stringify({
        query: "query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}",
        variables: { login: config.username, from: `${year}-01-01T00:00:00Z`, to: `${toDate}T23:59:59Z` },
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.errors?.length) throw new Error(`GitHub contribution source returned HTTP ${response.status}`);
    const weeks = body?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!Array.isArray(weeks)) throw new Error("GitHub contribution source returned malformed data");
    for (const week of weeks) for (const day of week.contributionDays ?? []) if (day.date >= start && day.date <= end) days.push({ date: day.date, value: day.contributionCount });
  }
  const provider = { metrics: { contributions: createMetricSeries("github", "contributions", "GitHub public contribution calendar", days, { lastSyncedAt: now, lastAttemptedAt: now }) } };
  validateRawProvider("github", provider);
  return provider;
}

async function fallbackSnapshot() {
  const file = path.join(ROOT, "public", "data", "activity.json");
  if (!existsSync(file)) return null;
  try { return upgradeSnapshot(JSON.parse(await readFile(file, "utf8"))); } catch { return null; }
}

export async function collect({ publish = true, preflight = false } = {}) {
  await loadEnvFile();
  const config = configuration();
  const now = new Date().toISOString();
  const end = dateInTimeZone(now, TIME_ZONE);
  const remote = await readRemoteSnapshot(config);
  const previous = remote?.snapshot ?? await fallbackSnapshot();
  // Best-effort Cursor dashboard CSV → usagePresence. Auth/network failures must
  // not block the rest of the hourly feed (hooks + GitHub still publish).
  if (!preflight) {
    try {
      await downloadCursorUsage([]);
    } catch (error) {
      process.stderr.write(`Live activity collector: ${error.message}\n`);
    }
  }
  const local = await exportLocalActivity();
  let localProviders;
  let hookStatus = "not-installed";
  const hookConfigExists = existsSync(path.join(config.activityHome, "config.json"));
  try {
    const hookState = await consumeHookSpool(config.activityHome);
    localProviders = mergeHookLedger(local.providers, hookState, now);
    hookStatus = "installed";
  } catch {
    localProviders = local.providers;
    if (hookConfigExists && previous) {
      localProviders.cursor = markProviderStale("cursor", previous.providers.cursor, now);
      localProviders["claude-code"] = markProviderStale("claude-code", previous.providers["claude-code"], now);
      hookStatus = "stale";
    }
  }
  let github;
  try {
    github = await fetchGitHubProvider(config, START_DATE, end, now);
  } catch (error) {
    if (!previous) throw error;
    github = markProviderStale("github", previous.providers.github, now);
  }
  const snapshot = assembleSnapshot({ github, ...localProviders }, { start: START_DATE, end, generatedAt: now });
  if (preflight) {
    return { published: false, changed: false, hookStatus, range: snapshot.range, repository: config.repository };
  }
  const changed = !previous || !snapshotsMatch(previous, snapshot);
  if (publish && changed) await publishSnapshot(config, snapshot, remote?.sha);
  return { published: publish && changed, changed, hookStatus, range: snapshot.range, repository: config.repository };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await collect({ publish: !process.argv.includes("--no-publish"), preflight: process.argv.includes("--preflight") });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
