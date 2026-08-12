import type { ActivityProvider, ActivitySummary as Summary, ProviderActivitySnapshot } from "@/lib/activity/types";

export function ActivitySummary({ summary, providers }: { summary: Summary; providers: Record<ActivityProvider, ProviderActivitySnapshot> }) {
  const observedInYear = (provider: ActivityProvider) =>
    providers[provider].status === "available" && providers[provider].days.length > 0;
  const metrics = [
    { value: summary.contributions.toLocaleString(), label: "GitHub contributions" },
    { value: observedInYear("codex") ? summary.codexActiveSessionDays.toLocaleString() : "N/A", label: "Codex active session-days" },
    { value: observedInYear("cursor") ? summary.cursorAiCodeEvents.toLocaleString() : "N/A", label: "Cursor AI code events" },
    { value: observedInYear("claude-code") ? summary.claudeActiveSessionDays.toLocaleString() : "N/A", label: "Claude active session-days" },
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
