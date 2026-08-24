import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addDays, validateSnapshot } from "./activity-core.mjs";
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

function yearDays(metric) {
  return metric.days.filter((day) => day.date.startsWith(year));
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

function assertMetric(label, feed, source, embeddedTotal) {
  assert.equal(feed.status, source.status, `${label} status differs from its source-native aggregate`);
  assert.deepEqual(feed.coverage, source.coverage, `${label} coverage differs from its source-native aggregate`);
  assert.equal(feed.source, source.source, `${label} source label differs from its source-native aggregate`);
  assert.equal(feed.lastSyncedAt, source.lastSyncedAt, `${label} freshness differs from its source-native aggregate`);
  assert.equal(total(feed), total(source), `${label} daily total differs from its source-native aggregate`);
  assert.equal(activeDates(feed).length, activeDates(source).length, `${label} active-date count differs from its source-native aggregate`);
  if (embeddedTotal !== undefined) assert.equal(embeddedTotal, total(feed), `${label} summary total differs from daily rows`);
}

const metrics = {
  github: snapshot.providers.github.metrics.contributions,
  codex: snapshot.providers.codex.metrics.activeSessions,
  cursorSessions: snapshot.providers.cursor.metrics.activeSessions,
  cursorUsage: snapshot.providers.cursor.metrics.usagePresence,
  cursorLines: snapshot.providers.cursor.metrics.appliedLineChanges,
  claude: snapshot.providers["claude-code"].metrics.activeSessions,
};
const sources = {
  github: github.metrics.contributions,
  codex: local.providers.codex.metrics.activeSessions,
  cursorSessions: local.providers.cursor.metrics.activeSessions,
  cursorUsage: local.providers.cursor.metrics.usagePresence,
  cursorLines: local.providers.cursor.metrics.appliedLineChanges,
  claude: local.providers["claude-code"].metrics.activeSessions,
};
const summary = snapshot.summaries[year];
assertMetric("GitHub contributions", metrics.github, sources.github, summary.contributions);
assertMetric("Codex sessions", metrics.codex, sources.codex, summary.codexActiveSessionDays);
assertMetric("Cursor sessions", metrics.cursorSessions, sources.cursorSessions, summary.cursorActiveSessionDays);
assertMetric("Cursor usage presence", metrics.cursorUsage, sources.cursorUsage);
assert.equal(metrics.cursorLines.status, "unavailable", "Cursor line changes must remain unavailable until direct edit hooks record measured diffs");
assert.equal(sources.cursorLines.status, "unavailable", "Source aggregate still exposes retired Cursor tracking rows as line changes");
assert.equal(summary.cursorAppliedAiLineChanges, 0, "Retired Cursor line-change summary must be zero");
assertMetric("Claude Code sessions", metrics.claude, sources.claude, summary.claudeActiveSessionDays);

const cursorFeedDates = new Set([...activeDates(metrics.cursorSessions), ...activeDates(metrics.cursorUsage)]);
const cursorSourceDates = new Set([...activeDates(sources.cursorSessions), ...activeDates(sources.cursorUsage)]);
assert.deepEqual([...cursorFeedDates].sort(), [...cursorSourceDates].sort(), "Cursor observed-date union differs from source aggregates");
const cursorObservedCoverage = {
  start: [metrics.cursorSessions.coverage.start, metrics.cursorUsage.coverage.start].filter(Boolean).sort()[0],
  end: [metrics.cursorSessions.coverage.end, metrics.cursorUsage.coverage.end].filter(Boolean).sort().at(-1),
};

const providerLookups = {
  github: new Map(metrics.github.days.map((day) => [day.date, day])),
  codex: new Map(metrics.codex.days.map((day) => [day.date, day])),
  cursor: new Map([...new Set([...metrics.cursorSessions.days.map((day) => day.date), ...metrics.cursorUsage.days.map((day) => day.date)])].map((date) => [date, {
    level: Math.max(metrics.cursorSessions.days.find((day) => day.date === date)?.level ?? 0, metrics.cursorUsage.days.find((day) => day.date === date)?.level ?? 0),
  }])),
  "claude-code": new Map(metrics.claude.days.map((day) => [day.date, day])),
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
  ["Codex sessions", "active session-days", metrics.codex, total(metrics.codex), total(sources.codex), activeDates(metrics.codex).length],
  ["Cursor sessions", "active session-days", metrics.cursorSessions, total(metrics.cursorSessions), total(sources.cursorSessions), activeDates(metrics.cursorSessions).length],
  ["Cursor usage evidence", "observed dates", metrics.cursorUsage, activeDates(metrics.cursorUsage).length, activeDates(sources.cursorUsage).length, activeDates(metrics.cursorUsage).length],
  ["Cursor observed union", "observed dates", { ...metrics.cursorSessions, source: "Cursor sessions + usage-presence union", coverage: cursorObservedCoverage }, cursorFeedDates.size, cursorSourceDates.size, cursorFeedDates.size],
  ["Claude Code sessions", "active session-days", metrics.claude, total(metrics.claude), total(sources.claude), activeDates(metrics.claude).length],
];
console.log(`Activity audit passed for ${year}; completed dates and the captured current date reconcile to source-native aggregates.`);
console.log("| Metric | Unit | Source | Coverage | Freshness | Feed total | Recalculated total | Active calendar days |");
console.log("|---|---|---|---|---|---:|---:|---:|");
for (const [label, unit, metric, feedTotal, sourceTotal, activeDayCount] of rows) {
  console.log(`| ${label} | ${unit} | ${metric.source} | ${metric.coverage.start} to ${metric.coverage.end} | ${metric.lastSyncedAt ?? "n/a"} | ${feedTotal} | ${sourceTotal} | ${activeDayCount} |`);
}
