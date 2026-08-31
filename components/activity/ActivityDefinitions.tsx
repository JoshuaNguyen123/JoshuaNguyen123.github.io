"use client";

import { useEffect, useMemo, useState } from "react";
import { combineCursorActivity, countActiveDays } from "@/lib/activity/cursor";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import { shouldUseActivitySnapshot } from "@/lib/activity/freshness.mjs";
import { addDays } from "@/lib/activity/calendar";
import { getCurrentStreak } from "@/lib/activity/streaks";
import {
  activeDaysNote,
  cursorDaysNote,
  summaryCardExplanations,
  summaryCardLabels,
  summaryCardNotes,
  summaryCardOrder,
} from "@/lib/activity/summary-cards";
import type { ActivityProvider, ActivitySnapshot, MetricActivitySnapshot } from "@/lib/activity/types";
import { activityProviders, providerLabels } from "@/lib/activity/types";

const liveFeedUrl = process.env.NEXT_PUBLIC_ACTIVITY_FEED_URL
  ?? "https://raw.githubusercontent.com/JoshuaNguyen123/JoshuaNguyen123.github.io/main/public/data/activity.json";

const timestampFormatter = (timeZone: string) => new Intl.DateTimeFormat("en-US", {
  timeZone,
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const limitations: Record<ActivityProvider, string> = {
  github: "A contribution is a public GitHub calendar event. It is not a measure of hours, difficulty, or code quality.",
  codex: "A session active on two dates contributes one session-day to each date. This does not count prompts, requests, tokens, or time spent.",
  cursor: "Session counts come from retained conversation timestamps. Usage evidence only confirms that Cursor was used on a date; it never invents a session count.",
  "claude-code": "Only retained Claude Code transcripts and hook events are counted. Cursor activity using a Claude model remains Cursor activity.",
};

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function total(metric: MetricActivitySnapshot, year: string): number {
  return metric.days.filter((day) => day.date.startsWith(year)).reduce((sum, day) => sum + day.value, 0);
}

// Active-day counts must be restricted to the displayed year so they always
// match the dashboard, which filters its metrics to the selected year.
function yearMetric(metric: MetricActivitySnapshot, year: string): MetricActivitySnapshot {
  return { ...metric, days: metric.days.filter((day) => day.date.startsWith(year)) };
}

export function ActivityDefinitions({ initialData }: { initialData: ActivitySnapshot }) {
  const [data, setData] = useState(initialData);
  const [feedState, setFeedState] = useState<"checking" | "live" | "fallback" | "bundled">("checking");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${liveFeedUrl}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Activity feed unavailable");
        const snapshot = parseActivitySnapshot(await response.json());
        if (!snapshot || snapshot.mode !== "observed") throw new Error("Activity feed invalid");
        if (!cancelled) {
          setData((current) => {
            const useLive = shouldUseActivitySnapshot(current, snapshot);
            setFeedState(useLive ? "live" : "bundled");
            return useLive ? snapshot : current;
          });
        }
      } catch {
        if (!cancelled) setFeedState("fallback");
      }
    };
    void load();
    const interval = window.setInterval(load, 300_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const year = data.range.end.slice(0, 4);
  const summary = data.summaries[year];
  const cursorObserved = useMemo(() => combineCursorActivity(
    data.providers.cursor.metrics.activeSessions,
    data.providers.cursor.metrics.usagePresence,
  ), [data]);
  const cursorObservedYear = yearMetric(cursorObserved, year);
  // Same computation as the dashboard: count back from the latest observed
  // day across the whole record, skipping a not-yet-active day in progress.
  const currentStreak = useMemo(() => {
    const activeDates = data.buildIndex.days.filter((day) => day.value > 0).map((day) => day.date);
    const anchor = new Set(activeDates).has(data.range.end) ? data.range.end : addDays(data.range.end, -1);
    return getCurrentStreak(activeDates, anchor);
  }, [data]);
  const overview = [
    { value: summary.contributions, label: summaryCardLabels.contributions, context: activeDaysNote(countActiveDays(yearMetric(data.providers.github.metrics.contributions, year))) },
    { value: summary.codexActiveSessionDays, label: summaryCardLabels.codexSessionDays, context: activeDaysNote(countActiveDays(yearMetric(data.providers.codex.metrics.activeSessions, year))) },
    { value: summary.cursorActiveSessionDays, label: summaryCardLabels.cursorSessionDays, context: cursorDaysNote(countActiveDays(yearMetric(data.providers.cursor.metrics.activeSessions, year)), countActiveDays(cursorObservedYear)) },
    { value: summary.claudeActiveSessionDays, label: summaryCardLabels.claudeSessionDays, context: activeDaysNote(countActiveDays(yearMetric(data.providers["claude-code"].metrics.activeSessions, year))) },
    { value: summary.activeDays, label: summaryCardLabels.observedBuildDays, context: summaryCardNotes.observedBuildDays },
    { value: countActiveDays(cursorObservedYear), label: summaryCardLabels.cursorObservedDays, context: summaryCardNotes.cursorObservedDays },
    { value: currentStreak, label: summaryCardLabels.currentStreak, context: summaryCardNotes.currentStreak },
    { value: summary.longestStreak, label: summaryCardLabels.longestStreak, context: summaryCardNotes.longestStreak },
  ];

  return (
    <>
      <div className="data-provenance" role="status">
        <span className={`data-dot data-dot--${feedState === "live" ? "live" : data.mode}`} />
        {feedState === "live" ? "Live activity feed" : feedState === "bundled" ? "Verified bundled snapshot · newer than live feed" : feedState === "fallback" ? "Verified bundled snapshot · live feed unavailable" : "Verified bundled snapshot · checking live feed"}
        {` · through ${formatDay(data.range.end)} · updated ${timestampFormatter(data.timeZone).format(new Date(data.generatedAt))}`}
      </div>

      <section className="activity-current" aria-labelledby="current-numbers">
        <div className="section-heading">
          <span className="eyebrow">Current record</span>
          <h2 id="current-numbers">What the {year} numbers actually say.</h2>
          <p>These are counts of observed tool activity, not a productivity score. They update from the same validated feed as the dashboard.</p>
        </div>
        <div className="activity-definition-summary">
          {overview.map((item) => (
            <article key={item.label}>
              <strong>{item.value.toLocaleString("en-US")}{item.label.includes("streak") ? "d" : ""}</strong>
              <span>{item.label}</span>
              <small>{item.context}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="activity-glossary" aria-labelledby="number-definitions">
        <div className="section-heading">
          <span className="eyebrow">Number by number</span>
          <h2 id="number-definitions">What each number counts, exactly.</h2>
        </div>
        <dl>
          {summaryCardOrder.map((id) => (
            <div key={id}><dt>{summaryCardLabels[id]}</dt><dd>{summaryCardExplanations[id]}</dd></div>
          ))}
        </dl>
      </section>

      <section className="activity-glossary" aria-labelledby="shading-definitions">
        <div className="section-heading">
          <span className="eyebrow">Intensity</span>
          <h2 id="shading-definitions">How a day earns its shade.</h2>
        </div>
        <dl>
          <div><dt>Each tool grades its own days</dt><dd>I take every day this year with any activity in that tool and line them up, quietest to busiest. The bottom quarter of those days gets the lightest shade, the next quarter the second, and so on — only the top tenth earns the darkest. A day at zero stays cream, and a Cursor day verified only by usage evidence always shows the lightest shade, because I know I was there but not how much I did.</dd></div>
          <div><dt>The Build Index is just the average</dt><dd>Every covered tool hands each day a grade from 0 to 5, and the Build Index averages them — that average, scaled to 100, is the percentage in the tooltip. Any activity at all keeps a square visible, so a light day never disappears.</dd></div>
          <div><dt>Darker means busier for me, not busy in general</dt><dd>Because every tool is graded on its own curve, the same shade in two heatmaps does not mean the same amount of work. Absolute thresholds would leave a naturally light tool permanently pale and a heavy one permanently dark, and the rhythm — the thing this page exists to show — would vanish.</dd></div>
          <div><dt>Shades can settle as the year fills in</dt><dd>The curve is recomputed from the whole year every time the feed publishes, so a spring day that once looked heavy can read a little more ordinary by autumn if the fall turns out busier. The counts underneath never change — only the comparison does.</dd></div>
        </dl>
      </section>

      <section className="activity-glossary" aria-labelledby="plain-english-definitions">
        <div className="section-heading">
          <span className="eyebrow">Plain-English definitions</span>
          <h2 id="plain-english-definitions">Four distinctions that keep the record honest.</h2>
        </div>
        <dl>
          <div><dt>Session-day</dt><dd>One distinct tool session observed on the calendar day the work happened (home base America/Denver; living-local when travelling). The same session can count again if it remains active on another date.</dd></div>
          <div><dt>Observed day</dt><dd>A date where at least one covered source recorded activity. For Cursor, first-party usage evidence can verify the date without creating a session count.</dd></div>
          <div><dt>Zero vs. no coverage</dt><dd>Zero means the collector covered that date and found nothing. A hatched day means the source did not cover that date, so the value is unknown.</dd></div>
          <div><dt>Build Index</dt><dd>An equal-weight blend of each covered tool&apos;s relative daily intensity. It is useful for visual pattern, not for comparing productivity or output.</dd></div>
        </dl>
      </section>

      <div className="tool-blocks">
        {activityProviders.map((provider) => (
          <article className="tool-block" key={provider}>
            <div className="heatmap-heading">
              <div>
                <span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />
                <h2>{providerLabels[provider]}</h2>
              </div>
            </div>
            {Object.entries(data.providers[provider].metrics).filter(([metricId]) => metricId !== "appliedLineChanges").map(([, metric]) => (
              <section className="metric-method" key={metric.definition.unit}>
                <strong>{metric.definition.label}</strong>
                <p>{metric.definition.methodology}</p>
                <p className="metric-limit"><strong>Does not mean:</strong> {limitations[provider]}</p>
                <dl className="tool-provenance">
                  <div><dt>Status</dt><dd>{metric.status === "available" ? "Observed within coverage" : metric.status === "stale" ? "Last verified data retained" : "Unavailable"}</dd></div>
                  <div><dt>{year} total</dt><dd>{metric.status === "unavailable" ? "Unavailable" : total(metric, year).toLocaleString("en-US")}</dd></div>
                  <div><dt>Source</dt><dd>{metric.source}</dd></div>
                  <div><dt>Coverage</dt><dd>{metric.coverage.start && metric.coverage.end ? `${formatDay(metric.coverage.start)} — ${formatDay(metric.coverage.end)}` : "Unavailable"}</dd></div>
                  <div><dt>Last verified</dt><dd>{metric.lastSyncedAt ? timestampFormatter(data.timeZone).format(new Date(metric.lastSyncedAt)) : "Unavailable"}</dd></div>
                </dl>
              </section>
            ))}
            {provider === "cursor" ? (
              <p className="metric-retirement-note"><strong>Why there is no line-change total:</strong> Cursor&apos;s retained tracking database records code hashes, not additions and deletions. That historical number has been removed. A line-change metric will return only after direct edit hooks produce verifiable line diffs.</p>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
