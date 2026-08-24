"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import { combineCursorActivity } from "@/lib/activity/cursor";
import { addDays } from "@/lib/activity/calendar";
import { getCurrentStreak } from "@/lib/activity/streaks";
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
  ?? "https://raw.githubusercontent.com/JoshuaNguyen123/JoshuaNguyen123.github.io/main/public/data/activity.json";
const pollDelayMs = 300_000;
const maxRetryDelayMs = 1_800_000;
const activityTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const buildIndexMetric: ProviderMetricDefinition = {
  label: "normalized index",
  unit: "normalized-index",
  methodology: "Equal-weight mean of GitHub contributions, Codex sessions, combined Cursor observed activity, and Claude Code sessions when each provider has coverage.",
  accuracy: "observed",
};

function describeValue(point: DailyActivityPoint | undefined, definition: ProviderMetricDefinition): string {
  if (!point) return "No source coverage";
  if (definition.unit === "contributions") return `${point.value} contribution${point.value === 1 ? "" : "s"}`;
  if (definition.unit === "active-sessions") return `${point.value} active session${point.value === 1 ? "" : "s"}`;
  if (definition.unit === "observed-usage") return point.value > 0 ? "Observed activity" : "No observed activity";
  if (definition.unit === "applied-ai-line-changes") return `${point.value} applied AI line change${point.value === 1 ? "" : "s"}`;
  return `${point.value}% normalized activity`;
}

function activityLabel(level: number): string {
  return ["No observed activity", "Light activity", "Steady activity", "Active day", "High activity", "Peak activity"][level] ?? "Activity";
}

function formatActivityTimestamp(value: string): string {
  return activityTimestampFormatter.format(new Date(value));
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

type FeedState = "checking" | "live" | "fallback" | "bundled";

export function ActivityDashboard({ initialData }: { initialData: ActivitySnapshot }) {
  const [data, setData] = useState(initialData);
  const [feedState, setFeedState] = useState<FeedState>("checking");
  const [cursorMetricId, setCursorMetricId] = useState<"observedActivity" | "activeSessions" | "usagePresence">("observedActivity");
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
        setData((current) => {
          const useLive = Date.parse(snapshot.generatedAt) > Date.parse(current.generatedAt);
          setFeedState(useLive ? "live" : "bundled");
          return useLive ? snapshot : current;
        });
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
    cursorUsage: filterMetric(data.providers.cursor.metrics.usagePresence, selectedRange.start, selectedRange.end),
    claude: filterMetric(data.providers["claude-code"].metrics.activeSessions, selectedRange.start, selectedRange.end),
  }), [data, selectedRange.end, selectedRange.start]);
  const cursorObserved = useMemo(
    () => combineCursorActivity(filteredMetrics.cursorSessions, filteredMetrics.cursorUsage),
    [filteredMetrics.cursorSessions, filteredMetrics.cursorUsage],
  );
  const cursorMetric = cursorMetricId === "observedActivity" ? cursorObserved
    : cursorMetricId === "activeSessions" ? filteredMetrics.cursorSessions
      : filteredMetrics.cursorUsage;
  const providerMetrics: Record<ActivityProvider, MetricActivitySnapshot> = {
    github: filteredMetrics.github,
    codex: filteredMetrics.codex,
    cursor: cursorMetric,
    "claude-code": filteredMetrics.claude,
  };
  const filteredBuildIndex = useMemo(() => data.buildIndex.days.filter((day) => day.date >= selectedRange.start && day.date <= selectedRange.end), [data, selectedRange.end, selectedRange.start]);
  // Current streak is independent of the selected year: it counts back from the
  // latest observed day. If that day has no activity yet, count from the day before.
  const currentStreak = useMemo(() => {
    const activeDates = data.buildIndex.days.filter((day) => day.value > 0).map((day) => day.date);
    const active = new Set(activeDates);
    const latest = data.range.end;
    const anchor = active.has(latest) ? latest : addDays(latest, -1);
    return getCurrentStreak(activeDates, anchor);
  }, [data]);
  const summary = data.summaries[String(selectedYear)] ?? { contributions: 0, codexActiveSessionDays: 0, cursorActiveSessionDays: 0, cursorAppliedAiLineChanges: 0, claudeActiveSessionDays: 0, activeDays: 0, longestStreak: 0 };

  function changeYear(year: number) {
    setSelectedYear(year);
    setSelectedDate(latestActiveDate(data, year));
  }

  const lookups = Object.fromEntries(Object.entries(providerMetrics).map(([provider, metric]) => [provider, new Map(metric.days.map((day) => [day.date, day]))])) as Record<ActivityProvider, Map<string, DailyActivityPoint>>;
  const cursorSessionLookup = new Map(filteredMetrics.cursorSessions.days.map((day) => [day.date, day]));
  const cursorUsageLookup = new Map(filteredMetrics.cursorUsage.days.map((day) => [day.date, day]));

  // The day card is anchored to the square that was pressed, in coordinates
  // relative to the dashboard, so it travels with the page rather than the viewport.
  const dashRef = useRef<HTMLDivElement>(null);
  const [dayCard, setDayCard] = useState<{ date: string; x: number; y: number } | null>(null);

  const openDayCard = useCallback((date: string, event: MouseEvent<HTMLButtonElement>) => {
    const host = dashRef.current?.getBoundingClientRect();
    if (!host) return;
    const cell = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(cell.left - host.left + cell.width / 2, 150), Math.max(host.width - 150, 150));
    setDayCard({ date, x, y: cell.bottom - host.top + 10 });
  }, []);

  useEffect(() => {
    if (!dayCard) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDayCard(null); };
    const onDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".day-detail") || target?.closest(".heatmap-cell")) return;
      setDayCard(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [dayCard]);

  const cardIndex = dayCard ? filteredBuildIndex.find((day) => day.date === dayCard.date) : undefined;
  const cardDate = dayCard
    ? new Date(dayCard.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";

  return (
    <div className="activity-dashboard" ref={dashRef}>
      <div className="activity-toolbar">
        <div>
          <span className="eyebrow">Activity</span>
          <h2>A record of when I was building.</h2>
          <p>Every square is one day, drawn from the tools I actually work in. It is a record, not a score, and it publishes daily counts only.</p>
        </div>
        <div className="year-selector" aria-label="Activity year">
          {availableYears.map((year) => (
            <button type="button" key={year} className={year === selectedYear ? "is-active" : ""} aria-pressed={year === selectedYear} onClick={() => changeYear(year)}>{year}</button>
          ))}
        </div>
      </div>

      <div className="data-provenance" role="status">
        <span className={`data-dot data-dot--${data.mode}`} />
        {data.mode === "fixture" ? "Development fixtures — never published" : feedState === "live"
          ? `Live activity feed · updated ${formatActivityTimestamp(data.generatedAt)}`
          : feedState === "bundled" ? `Verified bundled snapshot · newer than live feed · updated ${formatActivityTimestamp(data.generatedAt)}`
          : feedState === "fallback" ? `Verified bundled snapshot · live feed unavailable · updated ${formatActivityTimestamp(data.generatedAt)}`
            : `Verified bundled snapshot · checking local hook feed · updated ${formatActivityTimestamp(data.generatedAt)}`}
      </div>

      <ActivitySummary summary={summary} currentStreak={currentStreak} metrics={{ ...filteredMetrics, cursorObserved }} />

      <div className="activity-workspace">
        <div className="heatmap-stack">
          <ActivityHeatmap title="Build Index" provider="build-index" data={filteredBuildIndex} metric={buildIndexMetric} coverage={{ start: filteredBuildIndex[0]?.date ?? null, end: filteredBuildIndex.at(-1)?.date ?? null }} startDate={selectedRange.start} endDate={selectedRange.end} selectedDate={dayCard?.date ?? selectedDate} onDaySelect={setSelectedDate} onDayOpen={openDayCard} featured />

          <div className="activity-legend" aria-label="Activity intensity legend">
            <div>
              <span>Quieter day</span>
              {[0, 1, 2, 3, 4, 5].map((level) => <i className={`level-${level}`} key={level} role="img" aria-label={`Intensity level ${level} of 5`} title={`Intensity level ${level} of 5`} />)}
              <span>Busier day</span>
            </div>
            <div>
              <i className="is-unobserved" role="img" aria-label="No source coverage" title="No source coverage" />
              <span>Hatched: before that tool kept records. Each tool keeps its own hue at the same lightness steps.</span>
            </div>
          </div>

          <p className="heatmap-group-label">By tool</p>

          {activityProviders.map((provider) => {
            const metric = providerMetrics[provider];
            return (
              <div key={provider}>
                {provider === "cursor" ? (
                  <div className="metric-selector" aria-label="Cursor metric">
                    <button type="button" aria-pressed={cursorMetricId === "observedActivity"} className={cursorMetricId === "observedActivity" ? "is-active" : ""} onClick={() => setCursorMetricId("observedActivity")}>Observed activity</button>
                    <button type="button" aria-pressed={cursorMetricId === "activeSessions"} className={cursorMetricId === "activeSessions" ? "is-active" : ""} onClick={() => setCursorMetricId("activeSessions")}>Active sessions</button>
                    <button type="button" aria-pressed={cursorMetricId === "usagePresence"} className={cursorMetricId === "usagePresence" ? "is-active" : ""} onClick={() => setCursorMetricId("usagePresence")}>Usage evidence</button>
                  </div>
                ) : null}
                <ActivityHeatmap title={providerLabels[provider]} provider={provider} data={metric.days} metric={metric.definition} coverage={metric.coverage} status={metric.status} startDate={selectedRange.start} endDate={selectedRange.end} selectedDate={dayCard?.date ?? selectedDate} onDaySelect={setSelectedDate} onDayOpen={openDayCard} />
                {provider === "claude-code" ? (
                  <p className="coverage-note">Coverage begins July 23, 2026. Claude Code deletes local session transcripts after 30 days by default, which erased earlier history before this feed launched—retention is now extended, so nothing is lost going forward.</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {dayCard ? (
          <aside className="day-detail" aria-live="polite" style={{ left: dayCard.x, top: dayCard.y, transform: "translateX(-50%)" }}>
            <button type="button" className="day-detail-close" aria-label="Close day details" onClick={() => setDayCard(null)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="detail-kicker">Selected day</span>
            <h3>{cardDate}</h3>
            <div className={`activity-level activity-level--${cardIndex?.level ?? 0}`}><span />{activityLabel(cardIndex?.level ?? 0)}</div>
            <dl>
              {activityProviders.map((provider) => {
                // The breakdown stays on comparable session/contribution counts even when
                // the Cursor heatmap is switched to another view.
                const detailMetric = provider === "cursor" ? filteredMetrics.cursorSessions : providerMetrics[provider];
                const detailPoint = provider === "cursor" ? cursorSessionLookup.get(dayCard.date) : lookups[provider].get(dayCard.date);
                const usagePoint = cursorUsageLookup.get(dayCard.date);
                const cursorSessions = cursorSessionLookup.get(dayCard.date)?.value ?? 0;
                const cursorUsage = usagePoint?.value ?? 0;
                return (
                  <div key={provider}>
                    <dt><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />{providerLabels[provider]}</dt>
                    <dd>
                      {detailMetric.status === "unavailable" ? "Source unavailable" : describeValue(detailPoint, detailMetric.definition)}
                      {provider === "cursor" ? (
                        <small>
                          {filteredMetrics.cursorUsage.status === "unavailable"
                            ? "Usage evidence unavailable"
                            : cursorUsage > 0
                              ? cursorSessions > 0
                                ? "Usage evidence verified"
                                : "Usage evidence only, no local session count"
                              : "No usage evidence"}
                        </small>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="detail-note">Only aggregate dates and counts are published. Prompts, code, filenames, paths, projects, repositories, titles, models, emails, and raw IDs never leave this machine.</p>
          </aside>
        ) : null}
      </div>

      <div className="activity-more">
        <p>Aggregate counts only — never prompts, code, filenames, or project names. Press any square to read that day.</p>
        <Link href="/activity/">Every metric, in depth</Link>
      </div>

      <details className="methodology-panel">
        <summary>How this activity is measured</summary>
        <p className="index-disclaimer"><strong>Build Index:</strong> {data.buildIndex.formula} {data.buildIndex.disclaimer}</p>
        <p className="index-disclaimer"><strong>Session-days and tiles:</strong> Each heatmap square is one America/Denver calendar date. Session-day totals sum distinct sessions observed on each date, so several sessions can share one square and a session active across dates counts once on each date. Providers are attributed by tool: Cursor calls to Claude models remain Cursor activity, while Claude Code uses Claude Code&apos;s own sessions and hooks.</p>
        <div className="methodology-grid">
          {activityProviders.map((provider) => (
            <article key={provider}>
              <div><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" /><h3>{providerLabels[provider]}</h3></div>
              {Object.entries(data.providers[provider].metrics).filter(([metricId]) => metricId !== "appliedLineChanges").map(([, metric]) => (
                <section className="metric-method" key={metric.definition.unit}>
                  <strong>{metric.definition.label}</strong><p>{metric.definition.methodology}</p>
                  <dl>
                    <dt>Status</dt><dd>{metric.status === "available" ? "Observed within coverage" : metric.status === "stale" ? "Last verified data retained" : "Unavailable"}</dd>
                    <dt>Source</dt><dd>{metric.source}</dd>
                    <dt>Coverage</dt><dd>{metric.coverage.start && metric.coverage.end ? metric.coverage.start + " — " + metric.coverage.end : "Unavailable"}</dd>
                    <dt>Last sync</dt><dd>{metric.lastSyncedAt ? formatActivityTimestamp(metric.lastSyncedAt) : "Unavailable"}</dd>
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
