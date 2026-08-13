"use client";

import { useEffect, useMemo, useState } from "react";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import type {
  ActivityProvider,
  ActivitySnapshot,
  DailyActivityPoint,
  MetricActivitySnapshot,
  ProviderMetricDefinition,
} from "@/lib/activity/types";
import { activityProviders, providerLabels } from "@/lib/activity/types";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { ActivitySummary } from "./ActivitySummary";

const liveFeedUrl = process.env.NEXT_PUBLIC_ACTIVITY_FEED_URL
  ?? "https://raw.githubusercontent.com/JoshuaNguyen123/JoshuaNguyen123.github.io/activity-data/activity.json";
const pollDelayMs = 60_000;
const maxRetryDelayMs = 300_000;

const buildIndexMetric: ProviderMetricDefinition = {
  label: "normalized index",
  unit: "normalized-index",
  methodology: "Equal-weight mean of GitHub contributions and Codex, Cursor, and Claude active-session levels when each metric has coverage.",
  accuracy: "observed",
};

function describeValue(point: DailyActivityPoint | undefined, definition: ProviderMetricDefinition): string {
  if (!point) return "No source coverage";
  if (definition.unit === "contributions") return `${point.value} contribution${point.value === 1 ? "" : "s"}`;
  if (definition.unit === "active-sessions") return `${point.value} active session${point.value === 1 ? "" : "s"}`;
  if (definition.unit === "applied-ai-line-changes") return `${point.value} applied AI line change${point.value === 1 ? "" : "s"}`;
  return `${point.value}% normalized activity`;
}

function activityLabel(level: number): string {
  return ["No observed activity", "Light activity", "Steady activity", "Active day", "High activity", "Peak activity"][level] ?? "Activity";
}

function yearRange(year: number, snapshot: ActivitySnapshot) {
  const end = snapshot.range.end;
  return { start: `${year}-01-01`, end: String(year) === end.slice(0, 4) ? end : `${year}-12-31` };
}

function yearsInSnapshot(snapshot: ActivitySnapshot): number[] {
  const start = Number(snapshot.range.start.slice(0, 4));
  const end = Number(snapshot.range.end.slice(0, 4));
  return Array.from({ length: end - start + 1 }, (_, index) => end - index);
}

function defaultYear(snapshot: ActivitySnapshot): number {
  const years = yearsInSnapshot(snapshot);
  return years.includes(2026) ? 2026 : years[0];
}

function latestActiveDate(snapshot: ActivitySnapshot, year: number): string {
  const range = yearRange(year, snapshot);
  return [...snapshot.buildIndex.days].reverse().find((point) => point.date >= range.start && point.date <= range.end && point.value > 0)?.date ?? range.end;
}

function filterMetric(metric: MetricActivitySnapshot, start: string, end: string): MetricActivitySnapshot {
  return { ...metric, days: metric.days.filter((day) => day.date >= start && day.date <= end) };
}

type FeedState = "checking" | "live" | "fallback";

export function ActivityDashboard({ initialData }: { initialData: ActivitySnapshot }) {
  const [data, setData] = useState(initialData);
  const [feedState, setFeedState] = useState<FeedState>("checking");
  const [cursorMetricId, setCursorMetricId] = useState<"activeSessions" | "appliedLineChanges">("appliedLineChanges");
  const availableYears = yearsInSnapshot(data);
  const [selectedYear, setSelectedYear] = useState(() => defaultYear(initialData));
  const selectedRange = yearRange(selectedYear, data);
  const [selectedDate, setSelectedDate] = useState(() => latestActiveDate(initialData, defaultYear(initialData)));

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      try {
        const response = await fetch(`${liveFeedUrl}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Live activity feed was unavailable");
        const snapshot = parseActivitySnapshot(await response.json());
        if (!snapshot || snapshot.mode !== "observed") throw new Error("Live activity feed failed validation");
        if (cancelled) return;
        failures = 0;
        setData((current) => snapshot.generatedAt === current.generatedAt ? current : snapshot);
        setFeedState("live");
      } catch {
        if (cancelled) return;
        failures += 1;
        setFeedState("fallback");
      }
      if (!cancelled) timeout = setTimeout(poll, failures ? Math.min(pollDelayMs * 2 ** failures, maxRetryDelayMs) : pollDelayMs);
    };
    void poll();
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); };
  }, []);

  const filteredMetrics = useMemo(() => ({
    github: filterMetric(data.providers.github.metrics.contributions, selectedRange.start, selectedRange.end),
    codex: filterMetric(data.providers.codex.metrics.activeSessions, selectedRange.start, selectedRange.end),
    cursorSessions: filterMetric(data.providers.cursor.metrics.activeSessions, selectedRange.start, selectedRange.end),
    cursorLines: filterMetric(data.providers.cursor.metrics.appliedLineChanges, selectedRange.start, selectedRange.end),
    claude: filterMetric(data.providers["claude-code"].metrics.activeSessions, selectedRange.start, selectedRange.end),
  }), [data, selectedRange.end, selectedRange.start]);
  const cursorMetric = cursorMetricId === "activeSessions" ? filteredMetrics.cursorSessions : filteredMetrics.cursorLines;
  const providerMetrics: Record<ActivityProvider, MetricActivitySnapshot> = {
    github: filteredMetrics.github,
    codex: filteredMetrics.codex,
    cursor: cursorMetric,
    "claude-code": filteredMetrics.claude,
  };
  const filteredBuildIndex = useMemo(() => data.buildIndex.days.filter((day) => day.date >= selectedRange.start && day.date <= selectedRange.end), [data, selectedRange.end, selectedRange.start]);
  const summary = data.summaries[String(selectedYear)] ?? { contributions: 0, codexActiveSessionDays: 0, cursorActiveSessionDays: 0, cursorAppliedAiLineChanges: 0, claudeActiveSessionDays: 0, activeDays: 0, longestStreak: 0 };

  function changeYear(year: number) {
    setSelectedYear(year);
    setSelectedDate(latestActiveDate(data, year));
  }

  const lookups = Object.fromEntries(Object.entries(providerMetrics).map(([provider, metric]) => [provider, new Map(metric.days.map((day) => [day.date, day]))])) as Record<ActivityProvider, Map<string, DailyActivityPoint>>;
  const cursorSessionLookup = new Map(filteredMetrics.cursorSessions.days.map((day) => [day.date, day]));
  const cursorLineLookup = new Map(filteredMetrics.cursorLines.days.map((day) => [day.date, day]));
  const selectedIndex = filteredBuildIndex.find((day) => day.date === selectedDate);
  const readableSelectedDate = new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div className="activity-dashboard">
      <div className="activity-toolbar">
        <div><span className="eyebrow">Build activity / 02</span><h2>Engineering activity</h2><p>Privacy-safe local activity from the tools I use to build software—no paid analytics service required.</p></div>
        <div className="year-selector" aria-label="Activity year">
          {availableYears.map((year) => <button type="button" key={year} className={year === selectedYear ? "is-active" : ""} aria-pressed={year === selectedYear} onClick={() => changeYear(year)}>{year}</button>)}
        </div>
      </div>

      <div className="data-provenance" role="status">
        <span className={`data-dot data-dot--${data.mode}`} />
        {data.mode === "fixture" ? "Development fixtures — never published" : feedState === "live"
          ? `Local hook feed · updated ${new Date(data.generatedAt).toLocaleString()}`
          : feedState === "fallback" ? `Verified bundled snapshot · live feed unavailable · updated ${new Date(data.generatedAt).toLocaleString()}`
            : `Verified bundled snapshot · checking local hook feed · updated ${new Date(data.generatedAt).toLocaleString()}`}
      </div>
      <ActivitySummary summary={summary} metrics={filteredMetrics} />

      <div className="activity-workspace">
        <div className="heatmap-stack">
          <ActivityHeatmap title="Build Index" provider="build-index" data={filteredBuildIndex} metric={buildIndexMetric} coverage={{ start: filteredBuildIndex[0]?.date ?? null, end: filteredBuildIndex.at(-1)?.date ?? null }} startDate={selectedRange.start} endDate={selectedRange.end} selectedDate={selectedDate} onDaySelect={setSelectedDate} featured />
          {activityProviders.map((provider) => {
            const metric = providerMetrics[provider];
            return (
              <div key={provider}>
                {provider === "cursor" ? (
                  <div className="metric-selector" aria-label="Cursor metric">
                    <button type="button" aria-pressed={cursorMetricId === "appliedLineChanges"} className={cursorMetricId === "appliedLineChanges" ? "is-active" : ""} onClick={() => setCursorMetricId("appliedLineChanges")}>Applied line changes</button>
                    <button type="button" aria-pressed={cursorMetricId === "activeSessions"} className={cursorMetricId === "activeSessions" ? "is-active" : ""} onClick={() => setCursorMetricId("activeSessions")}>Active sessions</button>
                  </div>
                ) : null}
                <ActivityHeatmap title={providerLabels[provider]} provider={provider} data={metric.days} metric={metric.definition} coverage={metric.coverage} status={metric.status} startDate={selectedRange.start} endDate={selectedRange.end} selectedDate={selectedDate} onDaySelect={setSelectedDate} />
              </div>
            );
          })}
        </div>

        <aside className="day-detail" aria-live="polite">
          <span className="detail-kicker">Selected day</span><h3>{readableSelectedDate}</h3>
          <div className={`activity-level activity-level--${selectedIndex?.level ?? 0}`}><span />{activityLabel(selectedIndex?.level ?? 0)}</div>
          <dl>
            {activityProviders.map((provider) => {
              const metric = providerMetrics[provider];
              return (
                <div key={provider}>
                  <dt><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />{providerLabels[provider]}</dt>
                  <dd>{metric.status === "unavailable" ? "Source unavailable" : describeValue(lookups[provider].get(selectedDate), metric.definition)}</dd>
                  {provider === "cursor" ? <small>{describeValue(cursorSessionLookup.get(selectedDate), filteredMetrics.cursorSessions.definition)} · {describeValue(cursorLineLookup.get(selectedDate), filteredMetrics.cursorLines.definition)}</small> : null}
                </div>
              );
            })}
          </dl>
          <p className="detail-note">Only aggregate dates and counts are published. Prompts, code, filenames, paths, projects, repositories, titles, models, emails, and raw IDs never leave this machine.</p>
        </aside>
      </div>

      <div className="activity-legend" aria-label="Activity intensity legend"><span>Less</span>{[0, 1, 2, 3, 4, 5].map((level) => <i className={`level-${level}`} key={level} />)}<span>More</span></div>
      <details className="methodology-panel">
        <summary>How this activity is measured</summary>
        <p className="index-disclaimer"><strong>Build Index:</strong> {data.buildIndex.formula} {data.buildIndex.disclaimer}</p>
        <div className="methodology-grid">
          {activityProviders.map((provider) => (
            <article key={provider}>
              <div><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" /><h3>{providerLabels[provider]}</h3></div>
              {Object.values(data.providers[provider].metrics).map((metric) => (
                <section className="metric-method" key={metric.definition.unit}>
                  <strong>{metric.definition.label}</strong><p>{metric.definition.methodology}</p>
                  <dl>
                    <dt>Status</dt><dd>{metric.status === "available" ? "Observed within coverage" : metric.status === "stale" ? "Last verified data retained" : "Unavailable"}</dd>
                    <dt>Source</dt><dd>{metric.source}</dd>
                    <dt>Coverage</dt><dd>{metric.coverage.start && metric.coverage.end ? `${metric.coverage.start} — ${metric.coverage.end}` : "Unavailable"}</dd>
                    <dt>Last sync</dt><dd>{metric.lastSyncedAt ? new Date(metric.lastSyncedAt).toLocaleString() : "Unavailable"}</dd>
                  </dl>
                </section>
              ))}
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
