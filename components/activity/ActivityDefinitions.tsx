"use client";

import { useEffect, useMemo, useState } from "react";
import { combineCursorActivity, countActiveDays } from "@/lib/activity/cursor";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import type { ActivityProvider, ActivitySnapshot, MetricActivitySnapshot } from "@/lib/activity/types";
import { activityProviders, providerLabels } from "@/lib/activity/types";

const liveFeedUrl = process.env.NEXT_PUBLIC_ACTIVITY_FEED_URL
  ?? "https://raw.githubusercontent.com/JoshuaNguyen123/JoshuaNguyen123.github.io/main/public/data/activity.json";

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
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
            const useLive = Date.parse(snapshot.generatedAt) > Date.parse(current.generatedAt);
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
  const overview = [
    { value: summary.contributions, label: "GitHub contributions", context: `${countActiveDays(data.providers.github.metrics.contributions)} active days` },
    { value: summary.codexActiveSessionDays, label: "Codex session-days", context: `${countActiveDays(data.providers.codex.metrics.activeSessions)} active days` },
    { value: summary.cursorActiveSessionDays, label: "Cursor session-days", context: `${countActiveDays(data.providers.cursor.metrics.activeSessions)} session-counted days · ${countActiveDays(cursorObserved)} observed days` },
    { value: summary.claudeActiveSessionDays, label: "Claude Code session-days", context: `${countActiveDays(data.providers["claude-code"].metrics.activeSessions)} active days` },
    { value: summary.activeDays, label: "Observed build days", context: "At least one covered source recorded activity" },
    { value: summary.longestStreak, label: "Longest observed streak", context: "Consecutive Build Index days" },
  ];

  return (
    <>
      <div className="data-provenance" role="status">
        <span className={`data-dot data-dot--${feedState === "live" ? "live" : data.mode}`} />
        {feedState === "live" ? "Live activity feed" : feedState === "bundled" ? "Verified bundled snapshot · newer than live feed" : feedState === "fallback" ? "Verified bundled snapshot · live feed unavailable" : "Verified bundled snapshot · checking live feed"}
        {` · through ${formatDay(data.range.end)} · updated ${timestampFormatter.format(new Date(data.generatedAt))}`}
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

      <section className="activity-glossary" aria-labelledby="plain-english-definitions">
        <div className="section-heading">
          <span className="eyebrow">Plain-English definitions</span>
          <h2 id="plain-english-definitions">Four distinctions that keep the record honest.</h2>
        </div>
        <dl>
          <div><dt>Session-day</dt><dd>One distinct tool session observed on one America/Denver calendar date. The same session can count again if it remains active on another date.</dd></div>
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
                  <div><dt>Last verified</dt><dd>{metric.lastSyncedAt ? timestampFormatter.format(new Date(metric.lastSyncedAt)) : "Unavailable"}</dd></div>
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
