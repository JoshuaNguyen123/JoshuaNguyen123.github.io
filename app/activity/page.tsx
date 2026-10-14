import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ActivityDefinitions } from "@/components/activity/ActivityDefinitions";
import { ActivityFeedProvider } from "@/components/activity/ActivityFeedProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ogImage } from "@/content/site";
import { loadActivitySnapshot } from "@/lib/activity/load";
import type { Metadata } from "next";
import Link from "next/link";

const title = "Engineering activity";
const description =
  "Every metric behind the activity record: what each one counts, where it comes from, the window it covers, and when it last synced.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/activity/" },
  openGraph: { title, description, type: "website", url: "/activity/", images: [ogImage] },
};

export default function ActivityDetail() {
  const data = loadActivitySnapshot();

  return (
    <>
      <SiteHeader current="activity" />
      <main id="main">
        <section className="activity-page studio-activity-page">
          <header className="studio-activity-intro">
            <span className="eyebrow">Activity</span>
            <h1>A record of the work behind the projects.</h1>
            <p>
              Explore the daily record, then the sources and definitions behind
              each number. These are counts of observed tool activity, not a
              productivity score. Everything is reduced to privacy-safe daily
              aggregates before it is published.
            </p>
          </header>
          <ActivityFeedProvider initialData={data}>
            <div className="studio-activity-dashboard">
              <ActivityDashboard />
            </div>
            <div className="studio-activity-definitions" id="activity-definitions">
              <ActivityDefinitions />
            </div>
          </ActivityFeedProvider>

          <div className="activity-more">
            <p>
              Only dates and counts are published. Prompts, code, filenames, paths,
              projects, repositories, titles, models, emails, and raw IDs never
              leave my machine.
            </p>
            <Link href="/#activity">Back to the homepage</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
