import type { ActivitySummary as Summary } from "@/lib/activity/types";

export function ActivitySummary({ summary }: { summary: Summary }) {
  const metrics = [
    { value: summary.contributions.toLocaleString(), label: "GitHub contributions" },
    { value: summary.codexSessions.toLocaleString(), label: "Codex sessions" },
    { value: summary.cursorEvents.toLocaleString(), label: "Cursor AI events" },
    { value: summary.claudeSessions.toLocaleString(), label: "Claude sessions" },
    { value: summary.activeDays.toLocaleString(), label: "active days" },
    { value: `${summary.longestStreak}d`, label: "longest streak" },
  ];
  return (
    <div className="summary-grid" aria-label="Observed activity summary">
      {metrics.map((metric) => (
        <div className="summary-metric" key={metric.label}>
          <strong>{metric.value}</strong><span>{metric.label}</span>
        </div>
      ))}
    </div>
  );
}
