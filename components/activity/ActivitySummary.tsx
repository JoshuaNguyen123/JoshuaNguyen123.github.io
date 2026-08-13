import type { ActivitySummary as Summary, MetricActivitySnapshot } from "@/lib/activity/types";

interface SummaryMetrics {
  github: MetricActivitySnapshot;
  codex: MetricActivitySnapshot;
  cursorSessions: MetricActivitySnapshot;
  cursorLines: MetricActivitySnapshot;
  claude: MetricActivitySnapshot;
}

export function ActivitySummary({ summary, metrics }: { summary: Summary; metrics: SummaryMetrics }) {
  const shown = (metric: MetricActivitySnapshot, value: number) => metric.status !== "unavailable" && metric.days.length ? value.toLocaleString() : "N/A";
  const items = [
    { value: shown(metrics.github, summary.contributions), label: "GitHub contributions" },
    { value: shown(metrics.codex, summary.codexActiveSessionDays), label: "Codex active session-days" },
    { value: shown(metrics.cursorSessions, summary.cursorActiveSessionDays), label: "Cursor active session-days" },
    { value: shown(metrics.cursorLines, summary.cursorAppliedAiLineChanges), label: "Cursor applied AI line changes" },
    { value: shown(metrics.claude, summary.claudeActiveSessionDays), label: "Claude active session-days" },
    { value: summary.activeDays.toLocaleString(), label: "active days" },
    { value: `${summary.longestStreak}d`, label: "longest streak" },
  ];
  return <div className="summary-grid" aria-label="Observed activity summary">{items.map((item) => <div className="summary-metric" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;
}
