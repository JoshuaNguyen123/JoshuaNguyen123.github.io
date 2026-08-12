"use client";

import { buildCalendarWeeks } from "@/lib/activity/calendar";
import { providerPalettes } from "@/lib/activity/palette";
import type {
  ActivityChannel,
  DailyActivityPoint,
  ProviderCoverage,
  ProviderMetricDefinition,
} from "@/lib/activity/types";
import type { CSSProperties } from "react";

interface ActivityHeatmapProps {
  title: string;
  provider: ActivityChannel;
  data: DailyActivityPoint[];
  metric: ProviderMetricDefinition;
  coverage: ProviderCoverage;
  startDate: string;
  endDate: string;
  status?: "available" | "unavailable";
  selectedDate: string;
  onDaySelect: (date: string) => void;
  featured?: boolean;
}

function formatValue(value: number, metric: ProviderMetricDefinition, provider: ActivityChannel): string {
  if (provider === "build-index") return `${value}% normalized activity`;
  if (metric.unit === "contributions") return `${value} contribution${value === 1 ? "" : "s"}`;
  if (metric.unit === "active-sessions") return `${value} active session${value === 1 ? "" : "s"}`;
  return `${value} AI code event${value === 1 ? "" : "s"}`;
}

export function ActivityHeatmap({
  title,
  provider,
  data,
  metric,
  coverage,
  startDate,
  endDate,
  status = "available",
  selectedDate,
  onDaySelect,
  featured = false,
}: ActivityHeatmapProps) {
  const weeks = buildCalendarWeeks(startDate, endDate);
  const byDate = new Map(data.map((point) => [point.date, point]));
  const palette = providerPalettes[provider];
  const paletteStyle = Object.fromEntries(
    palette.map((color, level) => [`--cell-level-${level}`, color]),
  ) as CSSProperties;

  return (
    <section
      className={`activity-heatmap activity-heatmap--${provider} ${featured ? "activity-heatmap--featured" : ""}`}
      aria-labelledby={`heatmap-${provider}`}
      style={paletteStyle}
    >
      <div className="heatmap-heading">
        <div>
          <span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />
          <h3 id={`heatmap-${provider}`}>{title}</h3>
          <span className="metric-label">{metric.label}</span>
        </div>
        {status !== "available" ? (
          <span className="provider-status">Source unavailable</span>
        ) : featured ? (
          <span className="provider-status provider-status--live">Equal-weight composite</span>
        ) : null}
      </div>

      <div className="heatmap-scroll" role="region" aria-label={`${title} activity calendar`}>
        <div className="heatmap-canvas" style={{ "--week-count": weeks.length } as CSSProperties}>
          <div className="month-row" aria-hidden="true">
            {weeks.map((week, index) => <span key={`${week.monthLabel ?? "month"}-${index}`}>{week.monthLabel}</span>)}
          </div>
          <div className="heatmap-body">
            <div className="weekday-labels" aria-hidden="true">
              <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
            </div>
            <div className="week-grid">
              {weeks.map((week, weekIndex) => (
                <div className="week-column" key={`week-${weekIndex}`}>
                  {week.cells.map((cell, dayIndex) => {
                    if (!cell.date || !cell.inRange) {
                      return <span className="heatmap-cell heatmap-cell--outside" key={`outside-${dayIndex}`} />;
                    }
                    const point = byDate.get(cell.date);
                    const covered =
                      status === "available" &&
                      Boolean(coverage.start && coverage.end && cell.date >= coverage.start && cell.date <= coverage.end);
                    const readableDate = new Date(`${cell.date}T00:00:00Z`).toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
                    });
                    if (!covered || !point) {
                      return (
                        <span
                          className="heatmap-cell heatmap-cell--unobserved"
                          key={cell.date}
                          title={`${readableDate} · no source coverage`}
                          aria-label={`${readableDate}: no ${title} source coverage`}
                          role="img"
                        />
                      );
                    }
                    const value = formatValue(point.value, metric, provider);
                    return (
                      <button
                        type="button"
                        key={cell.date}
                        className={`heatmap-cell level-${point.level} ${selectedDate === cell.date ? "is-selected" : ""}`}
                        aria-label={`${readableDate}: ${value} observed from ${title}`}
                        aria-pressed={selectedDate === cell.date}
                        data-level={point.level}
                        title={`${readableDate} · ${value} · intensity ${point.level} of 5`}
                        onClick={() => onDaySelect(cell.date!)}
                        onFocus={() => onDaySelect(cell.date!)}
                        onMouseEnter={() => onDaySelect(cell.date!)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
