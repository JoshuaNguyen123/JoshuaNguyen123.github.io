import { monthlyActivity } from "@/lib/activity/monthly.mjs";
import type { MetricActivitySnapshot } from "@/lib/activity/types";

export function SourceCoverage({ sources, startDate, endDate }: {
  sources: { label: string; metric: MetricActivitySnapshot }[];
  startDate: string;
  endDate: string;
}) {
  return <div className="source-coverage">
    <p>A covered day has a retained record, including a recorded zero. Missing days are unknown, not inactive. Evidence can confirm activity without providing a session count.</p>
    {/* Keyboard focus lets readers scroll the table with arrow keys on narrow screens. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="coverage-scroll" role="region" aria-label="Source coverage table, scroll horizontally on small screens" tabIndex={0}>
      <table>
        <caption>Coverage from {startDate} through {endDate}</caption>
        <thead><tr><th scope="col">Source</th><th scope="col">Days with records</th><th scope="col">Unknown days</th></tr></thead>
        <tbody>{sources.map(({ label, metric }) => {
          const months = monthlyActivity(metric, startDate, endDate);
          const covered = months.reduce((total, month) => total + month.coveredDays, 0);
          const elapsed = months.reduce((total, month) => total + month.elapsedDays, 0);
          return <tr key={label}>
            <th scope="row">{label}{metric.status === "stale" ? <small>Last verified records retained</small> : metric.status === "unavailable" ? <small>Source unavailable</small> : null}</th>
            <td>{metric.status === "unavailable" ? "Unavailable" : `${covered} / ${elapsed}`}</td>
            <td>{elapsed - covered}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p>Coverage measures available records, not time worked. Sources may cover the same day; their counts should not be added together.</p>
  </div>;
}
