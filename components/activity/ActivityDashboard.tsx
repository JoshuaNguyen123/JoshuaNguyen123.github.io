"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import { shouldUseActivitySnapshot } from "@/lib/activity/freshness.mjs";
import { combineCursorActivity, combineRepositoryActivity } from "@/lib/activity/cursor";
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
const activityTimestampFormatter = (timeZone: string) => new Intl.DateTimeFormat("en-US", {
  timeZone,
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
  methodology: "Equal-weight mean of GitHub contributions and each AI tool's observed activity when that provider has coverage.",
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

function formatActivityTimestamp(value: string, timeZone: string): string {
  return activityTimestampFormatter(timeZone).format(new Date(value));
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
          const useLive = shouldUseActivitySnapshot(current, snapshot);
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
    codexSessions: filterMetric(data.providers.codex.metrics.activeSessions, selectedRange.start, selectedRange.end),
    codexEvidence: filterMetric(data.providers.codex.metrics.repositoryEvidence, selectedRange.start, selectedRange.end),
    cursorSessions: filterMetric(data.providers.cursor.metrics.activeSessions, selectedRange.start, selectedRange.end),
    cursorUsage: filterMetric(data.providers.cursor.metrics.usagePresence, selectedRange.start, selectedRange.end),
    claudeSessions: filterMetric(data.providers["claude-code"].metrics.activeSessions, selectedRange.start, selectedRange.end),
    claudeEvidence: filterMetric(data.providers["claude-code"].metrics.repositoryEvidence, selectedRange.start, selectedRange.end),
  }), [data, selectedRange.end, selectedRange.start]);
  const cursorObserved = useMemo(
    () => combineCursorActivity(filteredMetrics.cursorSessions, filteredMetrics.cursorUsage),
    [filteredMetrics.cursorSessions, filteredMetrics.cursorUsage],
  );
  const codexObserved = useMemo(
    () => combineRepositoryActivity(filteredMetrics.codexSessions, filteredMetrics.codexEvidence, "Codex"),
    [filteredMetrics.codexEvidence, filteredMetrics.codexSessions],
  );
  const claudeObserved = useMemo(
    () => combineRepositoryActivity(filteredMetrics.claudeSessions, filteredMetrics.claudeEvidence, "Claude Code"),
    [filteredMetrics.claudeEvidence, filteredMetrics.claudeSessions],
  );
  const cursorMetric = cursorMetricId === "observedActivity" ? cursorObserved
    : cursorMetricId === "activeSessions" ? filteredMetrics.cursorSessions
      : filteredMetrics.cursorUsage;
  const providerMetrics: Record<ActivityProvider, MetricActivitySnapshot> = {
    github: filteredMetrics.github,
    codex: codexObserved,
    cursor: cursorMetric,
    "claude-code": claudeObserved,
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
  const codexSessionLookup = new Map(filteredMetrics.codexSessions.days.map((day) => [day.date, day]));
  const codexEvidenceLookup = new Map(filteredMetrics.codexEvidence.days.map((day) => [day.date, day]));
  const cursorSessionLookup = new Map(filteredMetrics.cursorSessions.days.map((day) => [day.date, day]));
  const cursorUsageLookup = new Map(filteredMetrics.cursorUsage.days.map((day) => [day.date, day]));
  const claudeSessionLookup = new Map(filteredMetrics.claudeSessions.days.map((day) => [day.date, day]));
  const claudeEvidenceLookup = new Map(filteredMetrics.claudeEvidence.days.map((day) => [day.date, day]));
  const repositoryEvidenceOnlyDates: Partial<Record<ActivityProvider, string[]>> = {
    codex: filteredMetrics.codexEvidence.days.filter((day) => day.value > 0 && (codexSessionLookup.get(day.date)?.value ?? 0) === 0).map((day) => day.date),
    "claude-code": filteredMetrics.claudeEvidence.days.filter((day) => day.value > 0 && (claudeSessionLookup.get(day.date)?.value ?? 0) === 0).map((day) => day.date),
  };

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
          ? `Live activity feed · updated ${formatActivityTimestamp(data.generatedAt, data.timeZone)}`
          : feedState === "bundled" ? `Verified bundled snapshot · newer than live feed · updated ${formatActivityTimestamp(data.generatedAt, data.timeZone)}`
          : feedState === "fallback" ? `Verified bundled snapshot · live feed unavailable · updated ${formatActivityTimestamp(data.generatedAt, data.timeZone)}`
            : `Verified bundled snapshot · checking local hook feed · updated ${formatActivityTimestamp(data.generatedAt, data.timeZone)}`}
      </div>

      <ActivitySummary summary={summary} currentStreak={currentStreak} metrics={{
        github: filteredMetrics.github,
        codex: filteredMetrics.codexSessions,
        cursorObserved,
        cursorSessions: filteredMetrics.cursorSessions,
        claude: filteredMetrics.claudeSessions,
      }} />

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
              <span>Hatched: no surviving source coverage.</span>
            </div>
            <div>
              <i className="is-repository-evidence" role="img" aria-label="GitHub repository evidence" title="GitHub repository evidence" />
              <span>Light outlined: GitHub repository evidence without a retained session count.</span>
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
                <ActivityHeatmap title={providerLabels[provider]} provider={provider} data={metric.days} metric={metric.definition} coverage={metric.coverage} status={metric.status} startDate={selectedRange.start} endDate={selectedRange.end} selectedDate={dayCard?.date ?? selectedDate} onDaySelect={setSelectedDate} onDayOpen={openDayCard} repositoryEvidenceOnlyDates={repositoryEvidenceOnlyDates[provider]} />
                {provider === "claude-code" ? (
                  <p className="coverage-note">GitHub repository evidence begins April 7, 2026. Retained local Claude Code sessions begin July 23; evidence-only days use the light outlined shade and never invent a session count.</p>
                ) : provider === "codex" ? (
                  <p className="coverage-note">GitHub repository evidence begins April 7, 2026. Retained local Codex sessions begin April 20; evidence-only days use the light outlined shade.</p>
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
                const detailMetric = provider === "cursor" ? filteredMetrics.cursorSessions
                  : provider === "codex" ? filteredMetrics.codexSessions
                    : provider === "claude-code" ? filteredMetrics.claudeSessions
                      : providerMetrics[provider];
                const detailPoint = provider === "cursor" ? cursorSessionLookup.get(dayCard.date)
                  : provider === "codex" ? codexSessionLookup.get(dayCard.date)
                    : provider === "claude-code" ? claudeSessionLookup.get(dayCard.date)
                      : lookups[provider].get(dayCard.date);
                const usagePoint = cursorUsageLookup.get(dayCard.date);
                const cursorSessions = cursorSessionLookup.get(dayCard.date)?.value ?? 0;
                const cursorUsage = usagePoint?.value ?? 0;
                const repositoryEvidence = provider === "codex" ? codexEvidenceLookup.get(dayCard.date)?.value ?? 0
                  : provider === "claude-code" ? claudeEvidenceLookup.get(dayCard.date)?.value ?? 0 : 0;
                const sessionValue = detailPoint?.value ?? 0;
                return (
                  <div key={provider}>
                    <dt><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />{providerLabels[provider]}</dt>
                    <dd>
                      {repositoryEvidence > 0 && sessionValue === 0
                        ? "GitHub repository evidence"
                        : detailMetric.status === "unavailable" ? "Source unavailable" : describeValue(detailPoint, detailMetric.definition)}
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
                      ) : repositoryEvidence > 0 ? (
                        <small>{sessionValue > 0 ? "Repository evidence also verified" : "No retained local session count"}</small>
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

      {/* High-level only: the exact definitions, sources, coverage windows,
          and shading math live on /activity, linked below. */}
      <details className="methodology-panel">
        <summary>How this activity is measured</summary>
        <p className="index-disclaimer">Every square is one calendar day: home base America/Denver, living-local when I travel. If a tool or a provider-attributed GitHub record saw me working that day, the day counts — and credit goes to the tool, not the model, so Cursor using a Claude model is still Cursor.</p>
        <p className="index-disclaimer">Shading is relative. Each tool grades its days against its own year — darker means busier than my usual, not busy by some absolute bar — and the Build Index averages those grades into one picture. It describes observed activity, not productivity.</p>
        <p className="index-disclaimer">Only daily counts are published. Prompts, code, filenames, and project names never leave my machine.</p>
        <p className="index-disclaimer">The exact definitions, sources, coverage windows, and the shading math live at <Link href="/activity/">Every metric, in depth</Link>.</p>
      </details>
    </div>
  );
}
