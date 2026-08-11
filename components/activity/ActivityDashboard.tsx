"use client";

import { useMemo, useState } from "react";
import type {
  ActivityChannel,
  ActivityDashboardPayload,
  ActivityProvider,
  DailyActivityPoint,
} from "@/lib/activity/types.ts";
import { activityProviders, providerLabels } from "@/lib/activity/types.ts";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { ActivitySummary } from "./ActivitySummary";

const orderedProviders: ActivityProvider[] = [
  "github",
  "codex",
  "cursor",
  "claude-code",
];

function latestActiveDate(payload: ActivityDashboardPayload): string {
  return (
    [...payload.overall].reverse().find((point) => point.value > 0)?.date ??
    payload.range.end
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return hours > 0 ? `${hours}h ${remainder.toString().padStart(2, "0")}m` : `${remainder}m`;
}

function describePoint(point: DailyActivityPoint | undefined): string {
  if (!point || point.value === 0) return "No recorded activity";
  if (point.unit === "contributions") {
    return `${point.value} contribution${point.value === 1 ? "" : "s"}`;
  }
  if (point.unit === "minutes") return formatDuration(point.value);
  return `${point.value}% normalized activity`;
}

function activityLabel(level: number): string {
  return ["No activity", "Light activity", "Steady activity", "Active day", "High activity", "Peak activity"][level] ?? "Activity";
}

export function ActivityDashboard({ initialData }: { initialData: ActivityDashboardPayload }) {
  const [payload, setPayload] = useState(initialData);
  const [selectedDate, setSelectedDate] = useState(() => latestActiveDate(initialData));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const selectedYear = Number(payload.range.start.slice(0, 4));
  const years = [currentYear, currentYear - 1];

  async function selectYear(year: number) {
    if (year === selectedYear || loading) return;
    setLoading(true);
    setNotice(null);
    const today = new Date().toISOString().slice(0, 10);
    const start = `${year}-01-01`;
    const end = year === currentYear ? today : `${year}-12-31`;
    try {
      const response = await fetch(`/api/activity?start=${start}&end=${end}`);
      if (!response.ok) throw new Error("Activity request failed");
      const nextPayload = (await response.json()) as ActivityDashboardPayload;
      setPayload(nextPayload);
      setSelectedDate(latestActiveDate(nextPayload));
    } catch {
      setNotice("That activity range could not be loaded. The current view is unchanged.");
    } finally {
      setLoading(false);
    }
  }

  const pointLookups = useMemo(() => {
    const entries: Array<[ActivityChannel, Map<string, DailyActivityPoint>]> = [
      ["overall", new Map(payload.overall.map((point) => [point.date, point]))],
      ...activityProviders.map((provider) => [
        provider,
        new Map(payload.providers[provider].data.map((point) => [point.date, point])),
      ] as [ActivityProvider, Map<string, DailyActivityPoint>]),
    ];
    return Object.fromEntries(entries) as Record<ActivityChannel, Map<string, DailyActivityPoint>>;
  }, [payload]);

  const selectedOverall = pointLookups.overall.get(selectedDate);
  const readableSelectedDate = new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className={`activity-dashboard ${loading ? "is-loading" : ""}`}>
      <div className="activity-toolbar">
        <div>
          <span className="eyebrow">Build activity / 02</span>
          <h2>Engineering activity</h2>
          <p>A normalized view of code, active development time, and AI-assisted sessions.</p>
        </div>
        <div className="year-selector" aria-label="Activity year">
          {years.map((year) => (
            <button
              type="button"
              key={year}
              className={year === selectedYear ? "is-active" : ""}
              aria-pressed={year === selectedYear}
              onClick={() => selectYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="data-provenance" role="status">
        <span className={`data-dot data-dot--${payload.mode}`} />
        {payload.mode === "fixture"
          ? "Demo telemetry — connect providers to publish live activity"
          : payload.mode === "live"
            ? "Live aggregate telemetry · cached for 15 minutes"
            : "Provider connections are not configured"}
      </div>
      {notice ? <p className="activity-notice">{notice}</p> : null}

      <ActivitySummary summary={payload.summary} />

      <div className="activity-workspace">
        <div className="heatmap-stack">
          <ActivityHeatmap
            title="Overall"
            provider="overall"
            data={payload.overall}
            startDate={payload.range.start}
            endDate={payload.range.end}
            selectedDate={selectedDate}
            onDaySelect={setSelectedDate}
            featured
          />
          {orderedProviders.map((provider) => (
            <ActivityHeatmap
              key={provider}
              title={providerLabels[provider]}
              provider={provider}
              data={payload.providers[provider].data}
              startDate={payload.range.start}
              endDate={payload.range.end}
              status={payload.providers[provider].status}
              selectedDate={selectedDate}
              onDaySelect={setSelectedDate}
            />
          ))}
        </div>

        <aside className="day-detail" aria-live="polite">
          <span className="detail-kicker">Selected day</span>
          <h3>{readableSelectedDate}</h3>
          <div className={`activity-level activity-level--${selectedOverall?.level ?? 0}`}>
            <span />
            {activityLabel(selectedOverall?.level ?? 0)}
          </div>
          <dl>
            {orderedProviders.map((provider) => {
              const result = payload.providers[provider];
              const point = pointLookups[provider].get(selectedDate);
              return (
                <div key={provider}>
                  <dt>
                    <span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />
                    {providerLabels[provider]}
                  </dt>
                  <dd>{result.status === "available" ? describePoint(point) : "Not connected"}</dd>
                  {point?.metadata?.sessions ? (
                    <small>{point.metadata.sessions} session{point.metadata.sessions === 1 ? "" : "s"}</small>
                  ) : null}
                </div>
              );
            })}
          </dl>
          <p className="detail-note">Values are aggregated. Repository names, prompts, files, and raw tool calls are never published.</p>
        </aside>
      </div>

      <div className="activity-legend" aria-label="Activity intensity legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <i className={`level-${level}`} key={level} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
