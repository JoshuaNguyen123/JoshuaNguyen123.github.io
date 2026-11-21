import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CinematicHero } from "@/components/site/CinematicHero";
import { PersonalIntro } from "@/components/site/PersonalIntro";
import { WorkIndex, type FeaturedProject } from "@/components/work/WorkIndex";
import { FEATURED_PROJECTS, projects } from "@/content/projects";
import { githubUrl, linkedInUrl, resumeUrl, siteName, siteUrl } from "@/content/site";
import { loadActivitySnapshot } from "@/lib/activity/load";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import Image from "next/image";
import type { CSSProperties } from "react";
import bands from "@/components/site/bands.module.css";
import styles from "./home.module.css";

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: siteName,
  url: siteUrl,
  image: `${siteUrl}/joshua-nguyen.jpg`,
  jobTitle: "Forward-deployed engineer and AI developer",
  address: { "@type": "PostalAddress", addressLocality: "Bozeman", addressRegion: "MT", addressCountry: "US" },
  sameAs: [githubUrl, linkedInUrl].filter(Boolean),
};

/** This year's Build Index as week columns, padded so each column starts on Sunday. */
function yearCalendar() {
  const snapshot = loadActivitySnapshot();
  const year = snapshot.range.end.slice(0, 4);
  const days = snapshot.buildIndex.days.filter((day) => day.date.startsWith(year));
  const leading = days.length ? new Date(`${days[0].date}T12:00:00Z`).getUTCDay() : 0;
  const cells = [...Array.from({ length: leading }, () => null), ...days];
  return {
    year,
    summary: snapshot.summaries[year],
    first: days[0]?.date,
    last: days.at(-1)?.date,
    weeks: Math.ceil(cells.length / 7),
    cells,
  };
}

export default function Home() {
  const latestPost = getPublishedPosts()[0];
  const calendar = yearCalendar();
  const featured: FeaturedProject[] = projects.slice(0, FEATURED_PROJECTS).flatMap(({ slug, number, title, tagline, discipline, href, image, preview, feature }) =>
    feature ? [{ slug, number, title, tagline, discipline, href, image, preview, ...feature }] : [],
  );

  return (
    <>
      <SiteHeader variant="overlay" />
      <main id="main" className={styles.main}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }} />

        <CinematicHero><PersonalIntro /></CinematicHero>

        <WorkIndex projects={featured} />

        <section className={`${bands.band} ${bands.flush}`} id="more" aria-labelledby="more-title">
          <h2 className="visually-hidden" id="more-title">More projects</h2>
          <ul className={styles.pairs}>
            {projects.slice(FEATURED_PROJECTS).map((project) => (
              <li key={project.slug}>
                <a href={`/work/${project.slug}/`}>
                  <span className={styles.pairTitle}>{project.title}</span>
                  <span className={styles.pairNote}>{project.tagline}</span>
                </a>
              </li>
            ))}
          </ul>
          <a className={bands.cta} href="/work/">All work</a>
        </section>

        <section className={`${bands.band} ${bands.flush}`} id="writing" aria-labelledby="writing-title">
          <h2 className={bands.title} id="writing-title">Writing</h2>
          {latestPost ? (
            <a className={`${bands.split} ${bands.splitFlip} ${styles.post}`} href={`/blog/${latestPost.slug}/`}>
              <h3 className={styles.postTitle}>{latestPost.title}</h3>
              <span>
                <span className={styles.postSummary}>{latestPost.summary}</span>
                <span className="writing-meta"><time dateTime={latestPost.publishedAt}>{formatDate(latestPost.publishedAt)}</time> · {latestPost.readingMinutes} min read</span>
              </span>
            </a>
          ) : null}
          <a className={bands.cta} href="/blog/">All writing</a>
        </section>

        <section className={`${bands.band} night`} id="activity" aria-labelledby="activity-title">
          <h2 className={bands.title} id="activity-title">Activity</h2>
          {calendar.summary ? (
            <dl className={styles.stats}>
              <div>
                <dt>active build days in {calendar.year} so far</dt>
                <dd>{calendar.summary.activeDays.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>days in the longest streak</dt>
                <dd>{calendar.summary.longestStreak.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>GitHub contributions this year</dt>
                <dd>{calendar.summary.contributions.toLocaleString("en-US")}</dd>
              </div>
            </dl>
          ) : null}
          <figure className={styles.calendar}>
            <div
              className={styles.cells}
              style={{ "--weeks": calendar.weeks } as CSSProperties}
              role="img"
              aria-label={`Daily Build Index for ${calendar.year}, one square per day; darker squares mean more activity.`}
            >
              {calendar.cells.map((day, index) => (
                <span key={day?.date ?? `pad-${index}`} className={styles.cell} data-level={day ? day.level : undefined} />
              ))}
            </div>
            <figcaption>
              <span>
                {calendar.first && calendar.last ? <>Build Index, {formatDate(calendar.first)} to {formatDate(calendar.last)}. </> : null}
                Daily totals only. No code, prompts, or project names.
              </span>
              <a href="/activity/">How each number is counted</a>
            </figcaption>
          </figure>
        </section>

        <section className={`${bands.band} ${bands.panel}`} id="about" aria-labelledby="about-title">
          <h2 className={bands.title} id="about-title">About</h2>
          <div className={`${bands.split} ${styles.photos}`}>
            <div className={styles.place}>
              <Image
                src="/images/hiking-goats.jpg"
                alt="Two mountain goats crossing a rocky ridge at sunset, high above a wide valley"
                width={1280}
                height={960}
                sizes="(max-width: 860px) 92vw, 58vw"
              />
            </div>
            <div className={styles.portrait}>
              <Image
                src="/joshua-nguyen.jpg"
                alt="Joshua Nguyen outdoors by the water, wearing glasses, a cap, and a fleece jacket"
                width={800}
                height={1000}
                sizes="(max-width: 860px) 280px, 40vw"
              />
            </div>
          </div>
          <div className={bands.split}>
            <p className={bands.statement}>
              I care about the parts of AI software that usually get skipped: the approval before a tool runs, the citation behind a sentence, the record you can replay when a step fails.
            </p>
            <div className={bands.prose}>
              <p>
                I work across the stack, from data pipelines and evaluation to the tools people use. I like problems that start out vague. I read what already exists and build a rough first version, then keep reshaping it until another person can understand it and trust it.
              </p>
              <p>I live in Bozeman, Montana. When I’m away from my desk, I’m usually at the gym, out hiking, or home with a book.</p>
            </div>
          </div>
        </section>

        <section className={`${bands.band} night`} id="contact" aria-labelledby="contact-title">
          <div className={`${bands.split} ${bands.splitFlip} ${styles.contact}`}>
            <div>
              <h2 className={bands.title} id="contact-title">Contact</h2>
              <p className={bands.statement}>If you have a question about a project or want to talk about something I wrote, send me a note.</p>
              <div className={styles.channels}>
                {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer">Message me on LinkedIn</a> : null}
                <a href={githubUrl} target="_blank" rel="noreferrer">GitHub, JoshuaNguyen123</a>
                {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer">Download my resume</a> : null}
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
