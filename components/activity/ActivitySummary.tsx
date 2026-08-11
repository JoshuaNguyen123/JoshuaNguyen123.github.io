import type { ActivitySummary as Summary } from "@/lib/activity/types.ts";

function formatHours(minutes: number): string {
  if (minutes === 0) return "0h";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 6) / 10}h`;
}

export function ActivitySummary({ summary }: { summary: Summary }) {
  const metrics = [
    { value: summary.totalContributions.toLocaleString(), label: "contributions" },
    { value: formatHours(summary.totalCodingMinutes), label: "active coding" },
    { value: summary.activeDays.toLocaleString(), label: "active days" },
    { value: summary.aiSessions.toLocaleString(), label: "AI sessions" },
    { value: `${summary.longestStreak}d`, label: "longest streak" },
    { value: formatHours(summary.averageActiveDayMinutes), label: "avg active day" },
  ];

  return (
    <div className="summary-grid" aria-label="Activity summary">
      {metrics.map((metric) => (
        <div className="summary-metric" key={metric.label}>
          <strong>{metric.value}</strong>
          <span>{metric.label}</span>
        </div>
      ))}
    </div>
  );
}
