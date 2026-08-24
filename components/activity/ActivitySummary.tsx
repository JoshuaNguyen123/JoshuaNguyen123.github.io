import type { ActivitySummary as Summary, MetricActivitySnapshot } from "@/lib/activity/types";
import { countActiveDays } from "@/lib/activity/cursor";

interface SummaryMetrics {
  github: MetricActivitySnapshot;
  codex: MetricActivitySnapshot;
  cursorObserved: MetricActivitySnapshot;
  cursorSessions: MetricActivitySnapshot;
  claude: MetricActivitySnapshot;
}

export function ActivitySummary({ summary, currentStreak, metrics }: { summary: Summary; currentStreak: number; metrics: SummaryMetrics }) {
  const shown = (metric: MetricActivitySnapshot, value: number) => metric.status !== "unavailable" && metric.days.length ? value.toLocaleString("en-US") : "N/A";
  const daysContext = (metric: MetricActivitySnapshot, label = "active calendar days") => metric.status !== "unavailable" && metric.days.length
    ? `across ${countActiveDays(metric).toLocaleString("en-US")} ${label}`
    : undefined;
  const items = [
    { value: shown(metrics.github, summary.contributions), label: "GitHub contributions" },
    { value: shown(metrics.codex, summary.codexActiveSessionDays), label: "Codex active session-days", context: daysContext(metrics.codex) },
    {
      value: shown(metrics.cursorSessions, summary.cursorActiveSessionDays),
      label: "Cursor active session-days",
      context: metrics.cursorSessions.status !== "unavailable" && metrics.cursorSessions.days.length
        ? `${countActiveDays(metrics.cursorSessions).toLocaleString("en-US")} session-counted days · ${countActiveDays(metrics.cursorObserved).toLocaleString("en-US")} observed days`
        : undefined,
    },
    { value: shown(metrics.claude, summary.claudeActiveSessionDays), label: "Claude active session-days", context: daysContext(metrics.claude) },
    { value: summary.activeDays.toLocaleString("en-US"), label: "observed build days" },
    {
      value: shown(metrics.cursorObserved, countActiveDays(metrics.cursorObserved)),
      label: "Cursor observed days",
      context: "session records + privacy-reduced usage-date evidence",
    },
    { value: `${currentStreak}d`, label: "current streak", context: "consecutive active days through the latest observed day" },
    { value: `${summary.longestStreak}d`, label: "longest streak" },
  ];
  return <div className="summary-grid" aria-label="Observed activity summary">{items.map((item) => <div className="summary-metric" key={item.label}><strong>{item.value}</strong><span>{item.label}</span>{item.context ? <small>{item.context}</small> : null}</div>)}</div>;
}
