import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { addDays, adoptCurrentDefinitions, validateSnapshot } from "./activity-core.mjs";
import { validateHistoryBackfill } from "./history-backfill-core.mjs";
import { applyHistoryBackfill } from "./local-exporter.mjs";

const root = process.cwd();
const publicFile = path.resolve(process.argv[2] ?? path.join(root, "public", "data", "activity.json"));
const snapshot = validateSnapshot(JSON.parse(await readFile(publicFile, "utf8")));
const github = JSON.parse(await readFile(path.join(root, "data", "github-activity.json"), "utf8"));
const local = JSON.parse(await readFile(path.join(root, "data", "local-activity.json"), "utf8"));
const historyBackfill = validateHistoryBackfill(JSON.parse(await readFile(path.join(root, "data", "history-backfill.json"), "utf8")));
applyHistoryBackfill(local.providers, historyBackfill);
const year = snapshot.range.end.slice(0, 4);

// The publisher pushes public/data/activity.json directly and never commits the
// local export, so a rebuild carries the last published local-tool history
// forward rather than regressing to the older committed aggregates. Every
// published day must therefore reconcile to the per-date maximum of the source
// export and that previous snapshot. See scripts/activity-published-history.mjs.
function previouslyPublished() {
  const result = spawnSync("git", ["show", "HEAD:public/data/activity.json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) return null;
  try {
    const parsed = validateSnapshot(adoptCurrentDefinitions(JSON.parse(result.stdout)));
    // Kept unconditional across zones: prepare-activity carries the published
    // snapshot forward by per-date max regardless of the zone it was bucketed
    // in, so the audit must reconcile against that same carried history or it
    // would expect a coverage window the feed legitimately exceeds.
    return parsed.mode === "observed" ? parsed : null;
  } catch {
    return null;
  }
}

function yearDays(metric) {
  return metric.days.filter((day) => day.date.startsWith(year));
}

function expectedDays(source, carried) {
  const expected = new Map(yearDays(source).map((day) => [day.date, day.value]));
  if (carried && carried.status !== "unavailable") {
    for (const day of yearDays(carried)) expected.set(day.date, Math.max(expected.get(day.date) ?? 0, day.value));
  }
  return expected;
}

function expectedActive(expected) {
  return [...expected].filter(([, value]) => value > 0).map(([date]) => date);
}

function expectedTotal(expected) {
  return [...expected.values()].reduce((sum, value) => sum + value, 0);
}

function laterTimestamp(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function statusRank(status) {
  return status === "available" ? 2 : status === "stale" ? 1 : 0;
}

function total(metric) {
  return yearDays(metric).reduce((sum, day) => sum + day.value, 0);
}

function activeDates(metric) {
  return yearDays(metric).filter((day) => day.value > 0).map((day) => day.date);
}

function longestStreak(dates) {
  let longest = 0;
  let current = 0;
  let previous;
  for (const date of [...new Set(dates)].sort()) {
    current = previous && addDays(previous, 1) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function assertMetric(label, feed, source, carried, embeddedTotal) {
  const usable = carried && carried.status !== "unavailable" && carried.days.length ? carried : null;
  const expectedStatus = usable && statusRank(usable.status) >= statusRank(source.status) ? usable.status : source.status;
  assert.equal(feed.status, expectedStatus, `${label} status differs from its source-native aggregate`);

  const starts = [source.coverage.start, usable?.coverage.start].filter(Boolean).sort();
  const ends = [source.coverage.end, usable?.coverage.end].filter(Boolean).sort();
  assert.deepEqual(
    feed.coverage,
    { start: starts[0] ?? null, end: ends.at(-1) ?? null },
    `${label} coverage differs from its source-native aggregate`,
  );
  assert.ok(
    [source.source, usable?.source].filter(Boolean).includes(feed.source),
    `${label} source label differs from its source-native aggregate`,
  );
  assert.equal(
    feed.lastSyncedAt,
    laterTimestamp(source.lastSyncedAt, usable?.lastSyncedAt ?? null),
    `${label} freshness differs from its source-native aggregate`,
  );

  const expected = expectedDays(source, usable);
  const published = new Map(yearDays(feed).map((day) => [day.date, day.value]));
  for (const [date, value] of expected) {
    if (value > 0) assert.equal(published.get(date), value, `${label} lost ${date} from its source or published record`);
  }
  for (const [date, value] of published) {
    assert.equal(value, expected.get(date) ?? 0, `${label} published ${date} without a source or published record for it`);
  }
  assert.equal(total(feed), expectedTotal(expected), `${label} daily total differs from its source-native aggregate`);
  assert.equal(activeDates(feed).length, expectedActive(expected).length, `${label} active-date count differs from its source-native aggregate`);
  if (embeddedTotal !== undefined) assert.equal(embeddedTotal, total(feed), `${label} summary total differs from daily rows`);
}

const metrics = {
  github: snapshot.providers.github.metrics.contributions,
  codex: snapshot.providers.codex.metrics.activeSessions,
  codexEvidence: snapshot.providers.codex.metrics.repositoryEvidence,
  cursorSessions: snapshot.providers.cursor.metrics.activeSessions,
  cursorUsage: snapshot.providers.cursor.metrics.usagePresence,
  cursorLines: snapshot.providers.cursor.metrics.appliedLineChanges,
  claude: snapshot.providers["claude-code"].metrics.activeSessions,
  claudeEvidence: snapshot.providers["claude-code"].metrics.repositoryEvidence,
};
const sources = {
  github: github.metrics.contributions,
  codex: local.providers.codex.metrics.activeSessions,
  codexEvidence: local.providers.codex.metrics.repositoryEvidence,
  cursorSessions: local.providers.cursor.metrics.activeSessions,
  cursorUsage: local.providers.cursor.metrics.usagePresence,
  cursorLines: local.providers.cursor.metrics.appliedLineChanges,
  claude: local.providers["claude-code"].metrics.activeSessions,
  claudeEvidence: local.providers["claude-code"].metrics.repositoryEvidence,
};
// GitHub is refetched on every build and is never carried forward, so it still
// reconciles to its source alone.
const published = previouslyPublished();
const carried = {
  github: null,
  codex: published?.providers.codex.metrics.activeSessions ?? null,
  codexEvidence: published?.providers.codex.metrics.repositoryEvidence ?? null,
  cursorSessions: published?.providers.cursor.metrics.activeSessions ?? null,
  cursorUsage: published?.providers.cursor.metrics.usagePresence ?? null,
  cursorLines: published?.providers.cursor.metrics.appliedLineChanges ?? null,
  claude: published?.providers["claude-code"].metrics.activeSessions ?? null,
  claudeEvidence: published?.providers["claude-code"].metrics.repositoryEvidence ?? null,
};

const summary = snapshot.summaries[year];
assertMetric("GitHub contributions", metrics.github, sources.github, carried.github, summary.contributions);
assertMetric("Codex sessions", metrics.codex, sources.codex, carried.codex, summary.codexActiveSessionDays);
assertMetric("Codex repository evidence", metrics.codexEvidence, sources.codexEvidence, carried.codexEvidence);
assertMetric("Cursor sessions", metrics.cursorSessions, sources.cursorSessions, carried.cursorSessions, summary.cursorActiveSessionDays);
assertMetric("Cursor usage presence", metrics.cursorUsage, sources.cursorUsage, carried.cursorUsage);
assert.equal(metrics.cursorLines.status, "unavailable", "Cursor line changes must remain unavailable until direct edit hooks record measured diffs");
assert.equal(sources.cursorLines.status, "unavailable", "Source aggregate still exposes retired Cursor tracking rows as line changes");
assert.equal(summary.cursorAppliedAiLineChanges, 0, "Retired Cursor line-change summary must be zero");
assertMetric("Claude Code sessions", metrics.claude, sources.claude, carried.claude, summary.claudeActiveSessionDays);
assertMetric("Claude Code repository evidence", metrics.claudeEvidence, sources.claudeEvidence, carried.claudeEvidence);

const cursorFeedDates = new Set([...activeDates(metrics.cursorSessions), ...activeDates(metrics.cursorUsage)]);
const cursorSourceDates = new Set([
  ...expectedActive(expectedDays(sources.cursorSessions, carried.cursorSessions)),
  ...expectedActive(expectedDays(sources.cursorUsage, carried.cursorUsage)),
]);
assert.deepEqual([...cursorFeedDates].sort(), [...cursorSourceDates].sort(), "Cursor observed-date union differs from source aggregates");
const cursorObservedCoverage = {
  start: [metrics.cursorSessions.coverage.start, metrics.cursorUsage.coverage.start].filter(Boolean).sort()[0],
  end: [metrics.cursorSessions.coverage.end, metrics.cursorUsage.coverage.end].filter(Boolean).sort().at(-1),
};

const providerLookups = {
  github: new Map(metrics.github.days.map((day) => [day.date, day])),
  codex: new Map([...new Set([...metrics.codex.days.map((day) => day.date), ...metrics.codexEvidence.days.map((day) => day.date)])].map((date) => [date, {
    level: Math.max(metrics.codex.days.find((day) => day.date === date)?.level ?? 0, metrics.codexEvidence.days.find((day) => day.date === date)?.level ?? 0),
  }])),
  cursor: new Map([...new Set([...metrics.cursorSessions.days.map((day) => day.date), ...metrics.cursorUsage.days.map((day) => day.date)])].map((date) => [date, {
    level: Math.max(metrics.cursorSessions.days.find((day) => day.date === date)?.level ?? 0, metrics.cursorUsage.days.find((day) => day.date === date)?.level ?? 0),
  }])),
  "claude-code": new Map([...new Set([...metrics.claude.days.map((day) => day.date), ...metrics.claudeEvidence.days.map((day) => day.date)])].map((date) => [date, {
    level: Math.max(metrics.claude.days.find((day) => day.date === date)?.level ?? 0, metrics.claudeEvidence.days.find((day) => day.date === date)?.level ?? 0),
  }])),
};
for (const point of snapshot.buildIndex.days) {
  const levels = Object.values(providerLookups).flatMap((lookup) => lookup.has(point.date) ? [lookup.get(point.date).level] : []);
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  const expectedValue = Math.round((mean / 5) * 100);
  const expectedLevel = expectedValue > 0 ? Math.max(1, Math.round(mean)) : 0;
  assert.deepEqual({ value: point.value, level: point.level }, { value: expectedValue, level: expectedLevel }, `Build Index mismatch on ${point.date}`);
}
assert.ok(snapshot.buildIndex.days.every((day) => day.value === 0 || day.level >= 1), "A positive Build Index point is visually empty");

for (const [summaryYear, values] of Object.entries(snapshot.summaries)) {
  const days = snapshot.buildIndex.days.filter((day) => day.date.startsWith(summaryYear) && day.value > 0);
  assert.equal(values.activeDays, days.length, `${summaryYear} active-day summary differs from Build Index rows`);
  assert.equal(values.longestStreak, longestStreak(days.map((day) => day.date)), `${summaryYear} streak differs from Build Index rows`);
}

const rows = [
  ["GitHub contributions", metrics.github.definition.unit, metrics.github, total(metrics.github), total(sources.github), activeDates(metrics.github).length],
  ["Codex sessions", "active session-days", metrics.codex, total(metrics.codex), expectedTotal(expectedDays(sources.codex, carried.codex)), activeDates(metrics.codex).length],
  ["Codex repository evidence", "observed dates", metrics.codexEvidence, activeDates(metrics.codexEvidence).length, expectedActive(expectedDays(sources.codexEvidence, carried.codexEvidence)).length, activeDates(metrics.codexEvidence).length],
  ["Cursor sessions", "active session-days", metrics.cursorSessions, total(metrics.cursorSessions), expectedTotal(expectedDays(sources.cursorSessions, carried.cursorSessions)), activeDates(metrics.cursorSessions).length],
  ["Cursor usage evidence", "observed dates", metrics.cursorUsage, activeDates(metrics.cursorUsage).length, expectedActive(expectedDays(sources.cursorUsage, carried.cursorUsage)).length, activeDates(metrics.cursorUsage).length],
  ["Cursor observed union", "observed dates", { ...metrics.cursorSessions, source: "Cursor sessions + usage-presence union", coverage: cursorObservedCoverage }, cursorFeedDates.size, cursorSourceDates.size, cursorFeedDates.size],
  ["Claude Code sessions", "active session-days", metrics.claude, total(metrics.claude), expectedTotal(expectedDays(sources.claude, carried.claude)), activeDates(metrics.claude).length],
  ["Claude Code repository evidence", "observed dates", metrics.claudeEvidence, activeDates(metrics.claudeEvidence).length, expectedActive(expectedDays(sources.claudeEvidence, carried.claudeEvidence)).length, activeDates(metrics.claudeEvidence).length],
];
console.log(`Activity audit passed for ${year}; completed dates and the captured current date reconcile to source-native aggregates.`);
console.log("| Metric | Unit | Source | Coverage | Freshness | Feed total | Recalculated total | Active calendar days |");
console.log("|---|---|---|---|---|---:|---:|---:|");
for (const [label, unit, metric, feedTotal, sourceTotal, activeDayCount] of rows) {
  console.log(`| ${label} | ${unit} | ${metric.source} | ${metric.coverage.start} to ${metric.coverage.end} | ${metric.lastSyncedAt ?? "n/a"} | ${feedTotal} | ${sourceTotal} | ${activeDayCount} |`);
}
