import type { ActivitySummary as Summary, MetricActivitySnapshot } from "@/lib/activity/types";
import { countActiveDays } from "@/lib/activity/cursor";
import { activeDaysNote, cursorDaysNote, summaryCardLabels, summaryCardNotes } from "@/lib/activity/summary-cards";

interface SummaryMetrics {
  github: MetricActivitySnapshot;
  codex: MetricActivitySnapshot;
  cursorObserved: MetricActivitySnapshot;
  cursorSessions: MetricActivitySnapshot;
  claude: MetricActivitySnapshot;
}

export function ActivitySummary({ summary, currentStreak, metrics }: { summary: Summary; currentStreak: number; metrics: SummaryMetrics }) {
  const shown = (metric: MetricActivitySnapshot, value: number) => metric.status !== "unavailable" && metric.days.length ? value.toLocaleString("en-US") : "N/A";
  const daysContext = (metric: MetricActivitySnapshot) => metric.status !== "unavailable" && metric.days.length
    ? activeDaysNote(countActiveDays(metric))
    : undefined;
  const items = [
    { value: shown(metrics.github, summary.contributions), label: summaryCardLabels.contributions, context: daysContext(metrics.github) },
    { value: shown(metrics.codex, summary.codexActiveSessionDays), label: summaryCardLabels.codexSessionDays, context: daysContext(metrics.codex) },
    {
      value: shown(metrics.cursorSessions, summary.cursorActiveSessionDays),
      label: summaryCardLabels.cursorSessionDays,
      context: metrics.cursorSessions.status !== "unavailable" && metrics.cursorSessions.days.length
        ? cursorDaysNote(countActiveDays(metrics.cursorSessions), countActiveDays(metrics.cursorObserved))
        : undefined,
    },
    { value: shown(metrics.claude, summary.claudeActiveSessionDays), label: summaryCardLabels.claudeSessionDays, context: daysContext(metrics.claude) },
    { value: summary.activeDays.toLocaleString("en-US"), label: summaryCardLabels.observedBuildDays, context: summaryCardNotes.observedBuildDays },
    {
      value: shown(metrics.cursorObserved, countActiveDays(metrics.cursorObserved)),
      label: summaryCardLabels.cursorObservedDays,
      context: summaryCardNotes.cursorObservedDays,
    },
    { value: `${currentStreak}d`, label: summaryCardLabels.currentStreak, context: summaryCardNotes.currentStreak },
    { value: `${summary.longestStreak}d`, label: summaryCardLabels.longestStreak, context: summaryCardNotes.longestStreak },
  ];
  return <div className="summary-grid" aria-label="Observed activity summary">{items.map((item) => <div className="summary-metric" key={item.label}><strong>{item.value}</strong><span>{item.label}</span>{item.context ? <small>{item.context}</small> : null}</div>)}</div>;
}
