import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ActivityDefinitions } from "@/components/activity/ActivityDefinitions";
import { ActivityFeedProvider } from "@/components/activity/ActivityFeedProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ScrollSections } from "@/components/site/ScrollSections";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/subpage.module.css";
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
      <main className={styles.main} id="main">
        <header className={styles.intro}>
          <p className={styles.kicker}>Activity</p>
          <h1>A record of the work behind the projects.</h1>
          <p className={styles.lede}>
            Explore the daily record, then the sources and definitions behind
            each number. These are counts of observed tool activity, not a
            productivity score. Everything is reduced to privacy-safe daily
            aggregates before it is published.
          </p>
        </header>
        <ScrollSections>
          <ActivityFeedProvider initialData={data}>
            <section className={styles.section} aria-labelledby="daily-record" data-section="Daily record">
              <h2 className={styles.label} id="daily-record" data-section-label>Daily record</h2>
              <div className={styles.content}>
                <ActivityDashboard />
              </div>
            </section>
            <div id="activity-definitions">
              <ActivityDefinitions />
            </div>
          </ActivityFeedProvider>

          <section className={styles.section} aria-labelledby="activity-privacy" data-section="Privacy">
            <h2 className={styles.label} id="activity-privacy" data-section-label>Privacy</h2>
            <div className={styles.content}>
              <p className={styles.prose}>
                Only dates and counts are published. Prompts, code, filenames, paths,
                projects, repositories, titles, models, emails, and raw IDs never
                leave my machine.
              </p>
              <Link className={styles.textLink} href="/#activity">Back to the homepage</Link>
            </div>
          </section>
        </ScrollSections>
      </main>
      <SiteFooter />
    </>
  );
}
