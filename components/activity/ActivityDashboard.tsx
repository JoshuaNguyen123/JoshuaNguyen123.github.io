"use client";

import { useMemo, useState } from "react";
import type {
  ActivityProvider,
  ActivitySnapshot,
  DailyActivityPoint,
  ProviderMetricDefinition,
} from "@/lib/activity/types";
import { activityProviders, providerLabels } from "@/lib/activity/types";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { ActivitySummary } from "./ActivitySummary";

const buildIndexMetric: ProviderMetricDefinition = {
  label: "normalized index",
  unit: "ai-code-events",
  methodology: "Equal-weight mean of each available provider's independently normalized daily level.",
  accuracy: "observed",
};

function describeValue(point: DailyActivityPoint | undefined, metric: ProviderMetricDefinition): string {
  if (!point) return "No source coverage";
  if (metric.unit === "contributions") return `${point.value} contribution${point.value === 1 ? "" : "s"}`;
  if (metric.unit === "active-sessions") return `${point.value} active session${point.value === 1 ? "" : "s"}`;
  return `${point.value} AI code event${point.value === 1 ? "" : "s"}`;
}

function activityLabel(level: number): string {
  return ["No observed activity", "Light activity", "Steady activity", "Active day", "High activity", "Peak activity"][level] ?? "Activity";
}

function yearRange(year: number, snapshot: ActivitySnapshot) {
  const today = snapshot.range.end;
  return { start: `${year}-01-01`, end: String(year) === today.slice(0, 4) ? today : `${year}-12-31` };
}

export function ActivityDashboard({ initialData }: { initialData: ActivitySnapshot }) {
  const availableYears = Array.from(
    new Set([initialData.range.end.slice(0, 4), initialData.range.start.slice(0, 4)]),
  ).map(Number).sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const selectedRange = yearRange(selectedYear, initialData);

  const filteredProviders = useMemo(() => Object.fromEntries(
    activityProviders.map((provider) => [provider, {
      ...initialData.providers[provider],
      days: initialData.providers[provider].days.filter(
        (day) => day.date >= selectedRange.start && day.date <= selectedRange.end,
      ),
    }]),
  ) as ActivitySnapshot["providers"], [initialData, selectedRange.start, selectedRange.end]);

  const filteredBuildIndex = useMemo(
    () => initialData.buildIndex.days.filter((day) => day.date >= selectedRange.start && day.date <= selectedRange.end),
    [initialData, selectedRange.start, selectedRange.end],
  );
  const buildIndexCoverage = {
    start: filteredBuildIndex[0]?.date ?? null,
    end: filteredBuildIndex.at(-1)?.date ?? null,
  };
  const initialSelectedDate = [...filteredBuildIndex].reverse().find((point) => point.value > 0)?.date ?? selectedRange.end;
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);

  function changeYear(year: number) {
    setSelectedYear(year);
    const range = yearRange(year, initialData);
    const latest = [...initialData.buildIndex.days]
      .reverse()
      .find((point) => point.date >= range.start && point.date <= range.end && point.value > 0)?.date;
    setSelectedDate(latest ?? range.end);
  }

  const pointLookups = useMemo(() => Object.fromEntries(
    activityProviders.map((provider) => [provider, new Map(filteredProviders[provider].days.map((day) => [day.date, day]))]),
  ) as Record<ActivityProvider, Map<string, DailyActivityPoint>>, [filteredProviders]);
  const buildIndexLookup = useMemo(() => new Map(filteredBuildIndex.map((day) => [day.date, day])), [filteredBuildIndex]);
  const selectedIndex = buildIndexLookup.get(selectedDate);
  const readableSelectedDate = new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const summary = initialData.summaries[String(selectedYear)] ?? {
    contributions: 0, codexActiveSessionDays: 0, cursorAiCodeEvents: 0, claudeActiveSessionDays: 0, activeDays: 0, longestStreak: 0,
  };

  return (
    <div className="activity-dashboard">
      <div className="activity-toolbar">
        <div>
          <span className="eyebrow">Build activity / 02</span>
          <h2>Engineering activity</h2>
          <p>Observed, source-native counts across the tools I use to build software.</p>
        </div>
        <div className="year-selector" aria-label="Activity year">
          {availableYears.map((year) => (
            <button type="button" key={year} className={year === selectedYear ? "is-active" : ""} aria-pressed={year === selectedYear} onClick={() => changeYear(year)}>{year}</button>
          ))}
        </div>
      </div>

      <div className="data-provenance" role="status">
        <span className={`data-dot data-dot--${initialData.mode}`} />
        {initialData.mode === "fixture" ? "Development fixtures — never published" : `Observed aggregates · updated ${new Date(initialData.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
      </div>
      <ActivitySummary summary={summary} providers={filteredProviders} />

      <div className="activity-workspace">
        <div className="heatmap-stack">
          <ActivityHeatmap
            title="Build Index" provider="build-index" data={filteredBuildIndex} metric={buildIndexMetric}
            coverage={buildIndexCoverage} startDate={selectedRange.start} endDate={selectedRange.end}
            selectedDate={selectedDate} onDaySelect={setSelectedDate} featured
          />
          {activityProviders.map((provider) => {
            const result = filteredProviders[provider];
            return (
              <ActivityHeatmap
                key={provider} title={providerLabels[provider]} provider={provider} data={result.days}
                metric={result.metric} coverage={result.coverage} status={result.status}
                startDate={selectedRange.start} endDate={selectedRange.end}
                selectedDate={selectedDate} onDaySelect={setSelectedDate}
              />
            );
          })}
        </div>

        <aside className="day-detail" aria-live="polite">
          <span className="detail-kicker">Selected day</span>
          <h3>{readableSelectedDate}</h3>
          <div className={`activity-level activity-level--${selectedIndex?.level ?? 0}`}><span />{activityLabel(selectedIndex?.level ?? 0)}</div>
          <dl>
            {activityProviders.map((provider) => {
              const result = filteredProviders[provider];
              const point = pointLookups[provider].get(selectedDate);
              return (
                <div key={provider}>
                  <dt><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />{providerLabels[provider]}</dt>
                  <dd>{result.status === "available" ? describeValue(point, result.metric) : "Source unavailable"}</dd>
                </div>
              );
            })}
          </dl>
          <p className="detail-note">Only aggregate dates and counts are published. Prompts, code, filenames, paths, projects, repositories, titles, models, and raw IDs never leave the source machine.</p>
        </aside>
      </div>

      <div className="activity-legend" aria-label="Activity intensity legend">
        <span>Less</span>{[0, 1, 2, 3, 4, 5].map((level) => <i className={`level-${level}`} key={level} />)}<span>More</span>
      </div>

      <details className="methodology-panel">
        <summary>How this activity is measured</summary>
        <p className="index-disclaimer"><strong>Build Index:</strong> {initialData.buildIndex.formula} {initialData.buildIndex.disclaimer}</p>
        <div className="methodology-grid">
          {activityProviders.map((provider) => {
            const item = initialData.providers[provider];
            return (
              <article key={provider}>
                <div><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" /><h3>{providerLabels[provider]}</h3></div>
                <strong>{item.metric.label}</strong>
                <p>{item.metric.methodology}</p>
                <dl>
                  <dt>Status</dt><dd>{item.status === "available" ? "Observed within coverage" : "Unavailable; excluded from index"}</dd>
                  <dt>Source</dt><dd>{item.source}</dd>
                  <dt>Coverage</dt><dd>{item.coverage.start && item.coverage.end ? `${item.coverage.start} — ${item.coverage.end}` : "Unavailable"}</dd>
                  <dt>Last sync</dt><dd>{item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : "Unavailable"}</dd>
                </dl>
              </article>
            );
          })}
        </div>
      </details>
    </div>
  );
}
