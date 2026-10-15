"use client";

import { useMemo } from "react";
import { combineCursorActivity, countActiveDays } from "@/lib/activity/cursor";
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
import type { ActivityProvider, MetricActivitySnapshot } from "@/lib/activity/types";
import { activityProviders, providerLabels } from "@/lib/activity/types";
import styles from "@/components/site/subpage.module.css";
import { useActivityFeed } from "./ActivityFeedProvider";

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
  codex: "A session active on two dates contributes one session-day to each date. GitHub repository evidence verifies only the date and provider; it does not create a session count.",
  cursor: "Session counts come from retained conversation timestamps. Usage evidence only confirms that Cursor was used on a date; it never invents a session count.",
  "claude-code": "Retained transcripts and hooks produce session counts. Provider-attributed GitHub evidence verifies only the date; Cursor activity using a Claude model remains Cursor activity.",
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

export function ActivityDefinitions() {
  const { data, feedState } = useActivityFeed();

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

  // Each part of the record is one labelled row, in the same frame as the
  // rest of the site: the label column names it, the content explains it.
  return (
    <>
      <section className={styles.section} aria-labelledby="current-numbers">
        <h2 className={styles.label} id="current-numbers">Current record</h2>
        <div className={styles.content}>
          <p className={styles.statement}>What the {year} numbers actually say.</p>
          <p className={styles.prose}>These are counts of observed tool activity, not a productivity score. They update from the same validated feed as the dashboard.</p>
          <div className="data-provenance" role="status">
            <span className={`data-dot data-dot--${feedState === "live" ? "live" : data.mode}`} />
            {feedState === "live" ? "Live activity feed" : feedState === "bundled" ? "Verified bundled snapshot · newer than live feed" : feedState === "fallback" ? "Verified bundled snapshot · live feed unavailable" : "Verified bundled snapshot · checking live feed"}
            {` · through ${formatDay(data.range.end)} · updated ${timestampFormatter(data.timeZone).format(new Date(data.generatedAt))}`}
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
        </div>
      </section>

      <section className={styles.section} aria-labelledby="number-definitions">
        <h2 className={styles.label} id="number-definitions">Number by number</h2>
        <div className={styles.content}>
          <p className={styles.statement}>What each number counts, exactly.</p>
          <dl className="activity-glossary">
            {summaryCardOrder.map((id) => (
              <div key={id}><dt>{summaryCardLabels[id]}</dt><dd>{summaryCardExplanations[id]}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="shading-definitions">
        <h2 className={styles.label} id="shading-definitions">Intensity</h2>
        <div className={styles.content}>
          <p className={styles.statement}>How a day earns its shade.</p>
          <dl className="activity-glossary">
            <div><dt>Each tool grades its own days</dt><dd>I take every day this year with any activity in that tool and line them up, quietest to busiest. The bottom quarter gets the lightest shade, the next quarter the second, and so on — only the top tenth earns the darkest. A day at zero stays light gray. A day verified only by Cursor usage data or provider-attributed GitHub evidence always uses the lightest shade, because I know the tool was active but not how many sessions occurred.</dd></div>
            <div><dt>The Build Index is just the average</dt><dd>Every covered tool hands each day a grade from 0 to 5, and the Build Index averages them — that average, scaled to 100, is the percentage in the tooltip. Any activity at all keeps a square visible, so a light day never disappears.</dd></div>
            <div><dt>Darker means busier for me, not busy in general</dt><dd>Because every tool is graded on its own curve, the same shade in two heatmaps does not mean the same amount of work. Absolute thresholds would leave a naturally light tool permanently pale and a heavy one permanently dark, and the rhythm — the thing this page exists to show — would vanish.</dd></div>
            <div><dt>Shades can settle as the year fills in</dt><dd>The curve is recomputed from the whole year every time the feed publishes, so a spring day that once looked heavy can read a little more ordinary by autumn if the fall turns out busier. The counts underneath never change — only the comparison does.</dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="plain-english-definitions">
        <h2 className={styles.label} id="plain-english-definitions">Plain-English definitions</h2>
        <div className={styles.content}>
          <p className={styles.statement}>Four distinctions that keep the record honest.</p>
          <dl className="activity-glossary">
            <div><dt>Session-day</dt><dd>One distinct tool session observed on the calendar day the work happened (home base America/Denver; living-local when travelling). The same session can count again if it remains active on another date.</dd></div>
            <div><dt>Observed day</dt><dd>A date where at least one covered source recorded activity. First-party Cursor usage or provider-attributed GitHub evidence can verify a date without creating a session count.</dd></div>
            <div><dt>Zero vs. no coverage</dt><dd>Zero means the collector covered that date and found nothing. A hatched day means the source did not cover that date, so the value is unknown.</dd></div>
            <div><dt>Build Index</dt><dd>An equal-weight blend of each covered tool&apos;s relative daily intensity. It is useful for visual pattern, not for comparing productivity or output.</dd></div>
          </dl>
        </div>
      </section>

      {activityProviders.map((provider) => (
        <section className={styles.section} key={provider} aria-labelledby={`tool-${provider}`}>
          <h2 className={`${styles.label} ${styles.markedLabel}`} id={`tool-${provider}`}>
            <span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />
            {providerLabels[provider]}
          </h2>
          <div className={styles.content}>
            {Object.entries(data.providers[provider].metrics).filter(([metricId]) => metricId !== "appliedLineChanges").map(([, metric]) => (
              <section className="metric-method" key={metric.definition.unit}>
                <h3>{metric.definition.label}</h3>
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
          </div>
        </section>
      ))}
    </>
  );
}
