"use client";

import { buildCalendarWeeks } from "@/lib/activity/calendar.ts";
import type {
  ActivityChannel,
  DailyActivityPoint,
} from "@/lib/activity/types.ts";

interface ActivityHeatmapProps {
  title: string;
  provider: ActivityChannel;
  data: DailyActivityPoint[];
  startDate: string;
  endDate: string;
  status?: "available" | "unavailable" | "error";
  selectedDate: string;
  onDaySelect: (date: string) => void;
  featured?: boolean;
}

function formatValue(point: DailyActivityPoint): string {
  if (point.unit === "contributions") {
    return `${point.value} contribution${point.value === 1 ? "" : "s"}`;
  }
  if (point.unit === "minutes") {
    const hours = Math.floor(point.value / 60);
    const minutes = Math.round(point.value % 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  if (point.unit === "score") return `${point.value}% normalized activity`;
  return `${point.value} ${point.unit}`;
}

function emptyPoint(date: string, provider: ActivityChannel): DailyActivityPoint {
  return {
    date,
    provider,
    value: 0,
    unit: provider === "github" ? "contributions" : provider === "overall" ? "score" : "minutes",
    level: 0,
  };
}

export function ActivityHeatmap({
  title,
  provider,
  data,
  startDate,
  endDate,
  status = "available",
  selectedDate,
  onDaySelect,
  featured = false,
}: ActivityHeatmapProps) {
  const weeks = buildCalendarWeeks(startDate, endDate);
  const byDate = new Map(data.map((point) => [point.date, point]));

  return (
    <section
      className={`activity-heatmap ${featured ? "activity-heatmap--featured" : ""}`}
      aria-labelledby={`heatmap-${provider}`}
    >
      <div className="heatmap-heading">
        <div>
          <span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />
          <h3 id={`heatmap-${provider}`}>{title}</h3>
        </div>
        {status !== "available" ? (
          <span className="provider-status">{status === "error" ? "Offline" : "Not connected"}</span>
        ) : featured ? (
          <span className="provider-status provider-status--live">Normalized composite</span>
        ) : null}
      </div>

      <div className="heatmap-scroll" role="region" aria-label={`${title} activity calendar, horizontally scrollable`}>
        <div className="heatmap-canvas" style={{ "--week-count": weeks.length } as React.CSSProperties}>
          <div className="month-row" aria-hidden="true">
            {weeks.map((week, index) => (
              <span key={`${week.monthLabel ?? "month"}-${index}`}>{week.monthLabel}</span>
            ))}
          </div>
          <div className="heatmap-body">
            <div className="weekday-labels" aria-hidden="true">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            <div className="week-grid">
              {weeks.map((week, weekIndex) => (
                <div className="week-column" key={`week-${weekIndex}`}>
                  {week.cells.map((cell, dayIndex) => {
                    if (!cell.date || !cell.inRange) {
                      return <span className="heatmap-cell heatmap-cell--outside" key={`outside-${dayIndex}`} />;
                    }
                    const point = byDate.get(cell.date) ?? emptyPoint(cell.date, provider);
                    const readableDate = new Date(`${cell.date}T00:00:00Z`).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    });
                    const value = formatValue(point);
                    const label = `${readableDate}: ${value} of ${title} activity`;
                    return (
                      <button
                        type="button"
                        key={cell.date}
                        className={`heatmap-cell level-${point.level} ${selectedDate === cell.date ? "is-selected" : ""}`}
                        aria-label={label}
                        aria-pressed={selectedDate === cell.date}
                        title={`${readableDate} · ${value}`}
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
