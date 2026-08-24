import { ActivityDefinitions } from "@/components/activity/ActivityDefinitions";
import { loadActivitySnapshot } from "@/lib/activity/load";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Engineering activity — Joshua Nguyen",
  description:
    "Every metric behind the activity record: what each one counts, where it comes from, the window it covers, and when it last synced.",
  alternates: { canonical: "/activity/" },
};

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
        <h1>A clearer record of when I was building.</h1>
        <p>
          This page explains exactly what each number counts, what it leaves
          out, how far the source reaches, and when it was last verified.
          Everything is reduced to privacy-safe daily aggregates before it is published.
        </p>
        <ActivityDefinitions initialData={data} />

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
