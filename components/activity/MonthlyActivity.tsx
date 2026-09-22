import { monthlyActivity } from "@/lib/activity/monthly.mjs";
import { activityProviders, providerLabels, type ActivityProvider, type MetricActivitySnapshot } from "@/lib/activity/types";
import type { CSSProperties } from "react";

export function MonthlyActivity({ metrics, startDate, endDate, selectedMonth, onMonthSelect }: {
  metrics: Record<ActivityProvider, MetricActivitySnapshot>;
  startDate: string; endDate: string; selectedMonth: string | null;
  onMonthSelect: (month: string) => void;
}) {
  const rows = activityProviders.map(provider => ({ provider, months: monthlyActivity(metrics[provider], startDate, endDate) }));
  const months = rows[0].months;
  return (
    <section className="monthly-patterns" aria-labelledby="monthly-title">
      <header>
        <div><h3 id="monthly-title">Monthly patterns</h3><p>Observed days per month, by tool.</p></div>
        <p>One day counts once, even when several sessions were recorded. Select a month to explore its daily calendar.</p>
      </header>
      <div className="monthly-scroll" role="region" aria-label="Monthly activity charts, scroll horizontally on small screens">
        <div className="monthly-charts" style={{ "--month-count": months.length } as CSSProperties}>
          <div className="monthly-axis" aria-hidden="true"><span />{months.map(month => <span key={month.key}>{month.label}{month.partialMonth ? "*" : ""}</span>)}</div>
          {rows.map(({ provider, months: values }) => (
            <div className={`monthly-row monthly-row--${provider}`} key={provider}>
              <div className="monthly-tool"><span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" /><strong>{providerLabels[provider]}</strong><small>Observed days</small></div>
              <div className="monthly-plot">
                <div className="monthly-scale" aria-hidden="true"><span>31</span><span>15</span><span>0</span></div>
                {values.map(month => {
                  const noCoverage = month.activeDays === null;
                  const gaps = month.coveredDays < month.elapsedDays;
                  const label = `${providerLabels[provider]}, ${month.label} ${month.key.slice(0, 4)}: ${noCoverage ? "no source coverage" : `${month.activeDays} observed days; ${month.coveredDays} of ${month.elapsedDays} elapsed days covered`}${month.partialMonth ? "; partial month" : ""}. Show daily calendar`;
                  return <button type="button" key={month.key} className={`monthly-bar-button${noCoverage ? " no-coverage" : ""}${gaps && !noCoverage ? " partial-coverage" : ""}`} style={{ "--bar-height": noCoverage ? "100%" : `${Math.max(2, month.activeDays! / 31 * 100)}%` } as CSSProperties} aria-label={label} title={label} aria-pressed={selectedMonth === month.key} onClick={() => onMonthSelect(month.key)}>
                    <span className="monthly-bar" aria-hidden="true" />
                    <span className="monthly-value" aria-hidden="true">{noCoverage ? "—" : month.activeDays}{gaps && !noCoverage ? "†" : ""}</span>
                  </button>;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="monthly-notes"><p>*Partial month, through {endDate}. †Some elapsed days have no source coverage.</p><p>Hatched: no source coverage. A labelled zero means covered days with no activity.</p></div>
      {selectedMonth ? <p className="monthly-selection" role="status">Calendar above is showing {months.find(month => month.key === selectedMonth)?.label} {selectedMonth.slice(0, 4)}.</p> : null}
    </section>
  );
}
