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
import frame from "@/components/site/frame.module.css";
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

        <div className={frame.frame}>
          <WorkIndex projects={featured} />

          <section className={`${frame.section} ${frame.continued}`} id="more" aria-labelledby="more-title">
            <h2 className={frame.label} id="more-title">More projects</h2>
            <div className={frame.content}>
              <ul className={frame.rows}>
                {projects.slice(FEATURED_PROJECTS).map((project) => (
                  <li key={project.slug}>
                    <a href={`/work/${project.slug}/`}>
                      <span className={frame.rowTitle}>{project.title}</span>
                      <span className={frame.rowNote}>{project.tagline}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <a className={frame.textLink} href="/work/">All work</a>
            </div>
          </section>

          <section className={frame.section} id="writing" aria-labelledby="writing-title">
            <h2 className={frame.label} id="writing-title">Writing</h2>
            <div className={frame.content}>
              {latestPost ? (
                <div className="writing-list">
                  <a href={`/blog/${latestPost.slug}/`}>
                    <h3>{latestPost.title}</h3>
                    <p>{latestPost.summary}</p>
                    <span className="writing-meta"><time dateTime={latestPost.publishedAt}>{formatDate(latestPost.publishedAt)}</time> · {latestPost.readingMinutes} min read</span>
                  </a>
                </div>
              ) : null}
              <a className={frame.textLink} href="/blog/">All writing</a>
            </div>
          </section>

          <section className={frame.section} id="activity" aria-labelledby="activity-title">
            <h2 className={frame.label} id="activity-title">Activity</h2>
            <div className={frame.content}>
              {calendar.summary ? (
                <p className={frame.statement}>
                  {calendar.summary.activeDays} active build days in {calendar.year} so far, and a longest streak of {calendar.summary.longestStreak} days.
                </p>
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
                  {calendar.first && calendar.last ? <span>Build Index, {formatDate(calendar.first)} to {formatDate(calendar.last)}</span> : null}
                  <span>Daily totals only. No code, prompts, or project names.</span>
                </figcaption>
              </figure>
              <a className={frame.textLink} href="/activity/">How each number is counted</a>
            </div>
          </section>

          <section className={frame.section} id="about" aria-labelledby="about-title">
            <h2 className={frame.label} id="about-title">About</h2>
            <div className={styles.about}>
              <figure className={styles.portrait}>
                <Image
                  src="/joshua-nguyen.jpg"
                  alt="Joshua Nguyen outdoors by the water, wearing glasses, a cap, and a fleece jacket"
                  width={800}
                  height={1000}
                  sizes="(max-width: 760px) 200px, 240px"
                />
              </figure>
              <div className={styles.aboutCopy}>
                <p className={frame.statement}>
                  I care about the parts of AI software that usually get skipped: the approval before a tool runs, the citation behind a sentence, the record you can replay when a step fails.
                </p>
                <p>
                  I work across the stack, from data pipelines and evaluation to the tools people use. I like problems that start out vague. I read what already exists and build a rough first version, then keep reshaping it until another person can understand it and trust it.
                </p>
                <p>I live in Bozeman, Montana. When I’m away from my desk, I’m usually at the gym, out hiking, or home with a book.</p>
              </div>
            </div>
          </section>

          <section className={frame.section} id="contact" aria-labelledby="contact-title">
            <h2 className={frame.label} id="contact-title">Contact</h2>
            <div className={`${frame.content} ${styles.contact}`}>
              <p className={frame.statement}>If you have a question about a project or want to talk about something I wrote, send me a note.</p>
              <dl className={frame.facts}>
                {linkedInUrl ? (
                  <>
                    <dt>LinkedIn</dt>
                    <dd><a href={linkedInUrl} target="_blank" rel="noreferrer">Message me on LinkedIn</a></dd>
                  </>
                ) : null}
                <dt>GitHub</dt>
                <dd><a href={githubUrl} target="_blank" rel="noreferrer">JoshuaNguyen123</a></dd>
                {resumeUrl ? (
                  <>
                    <dt>Resume</dt>
                    <dd><a href={resumeUrl} target="_blank" rel="noreferrer">Download the PDF</a></dd>
                  </>
                ) : null}
              </dl>
              <ContactForm />
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
