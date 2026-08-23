import { loadActivitySnapshot } from "@/lib/activity/load";
import { activityProviders, providerLabels } from "@/lib/activity/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Engineering activity — Joshua Nguyen",
  description:
    "Every metric behind the activity record: what each one counts, where it comes from, the window it covers, and when it last synced.",
  alternates: { canonical: "/activity/" },
};

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function ActivityDetail() {
  const data = loadActivitySnapshot();

  return (
    <main>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Joshua Nguyen home">
          Joshua Nguyen
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/#about">About</Link>
          <Link href="/#work">Work</Link>
          <Link href="/blog/">Writing</Link>
          <Link href="/#activity" aria-current="page">Activity</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
      </header>

      <section className="activity-page">
        <span className="eyebrow">Activity</span>
        <h1>Every metric, and how each one is measured.</h1>
        <p>
          Each tool is collected on my own machine, reduced to one number per
          calendar date in America/Denver, and published as aggregates. Where a
          tool has no record yet, the day is drawn as a hatched square rather
          than as a zero.
        </p>

        <div className="data-provenance" role="status">
          <span className={`data-dot data-dot--${data.mode}`} />
          {`Covering ${formatDay(data.range.start)} to ${formatDay(data.range.end)} · generated ${timestampFormatter.format(new Date(data.generatedAt))}`}
        </div>

        <div className="tool-blocks">
          {activityProviders.map((provider) => (
            <article className="tool-block" key={provider}>
              <div className="heatmap-heading">
                <div>
                  <span className={`provider-mark provider-mark--${provider}`} aria-hidden="true" />
                  <h2>{providerLabels[provider]}</h2>
                </div>
              </div>
              {Object.values(data.providers[provider].metrics).map((metric) => (
                <section className="metric-method" key={metric.definition.unit}>
                  <strong>{metric.definition.label}</strong>
                  <p>{metric.definition.methodology}</p>
                  <dl className="tool-provenance">
                    <div>
                      <dt>Status</dt>
                      <dd>{metric.status === "available" ? "Observed within coverage" : metric.status === "stale" ? "Last verified data retained" : "Unavailable"}</dd>
                    </div>
                    <div><dt>Source</dt><dd>{metric.source}</dd></div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>{metric.coverage.start && metric.coverage.end ? `${formatDay(metric.coverage.start)} — ${formatDay(metric.coverage.end)}` : "Unavailable"}</dd>
                    </div>
                    <div>
                      <dt>Last sync</dt>
                      <dd>{metric.lastSyncedAt ? timestampFormatter.format(new Date(metric.lastSyncedAt)) : "Unavailable"}</dd>
                    </div>
                  </dl>
                </section>
              ))}
            </article>
          ))}
        </div>

        <div className="activity-more">
          <p>
            Only dates and counts are published. Prompts, code, filenames, paths,
            projects, repositories, titles, models, emails, and raw IDs never
            leave my machine.
          </p>
          <Link href="/#activity">Back to the year grids</Link>
        </div>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Joshua Nguyen</span>
        <span>Built with Next.js, published on GitHub Pages</span>
      </footer>
    </main>
  );
}
