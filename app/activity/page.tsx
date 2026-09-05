import { ActivityDefinitions } from "@/components/activity/ActivityDefinitions";
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
      </main>
      <SiteFooter />
    </>
  );
}