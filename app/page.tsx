import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkIndex, type FeaturedProject } from "@/components/work/WorkIndex";
import { FEATURED_PROJECTS, projects } from "@/content/projects";
import { availability, currentFocus, githubUrl, linkedInUrl, resumeUrl, siteName, siteUrl } from "@/content/site";
import { loadActivitySnapshot } from "@/lib/activity/load";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./home.module.css";

const interests = [
  ["AI engineering", "Agents and retrieval systems that are grounded, observable, and worth trusting."],
  ["Software development", "Small, well-tested pieces with clear contracts and useful errors."],
  ["Systems engineering", "Pipelines, runners, and local-first tools that keep working when no one is watching."],
] as const;

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
  const featured: FeaturedProject[] = projects.slice(0, FEATURED_PROJECTS).flatMap(({ slug, number, title, discipline, href, image, feature }) =>
    feature ? [{ slug, number, title, discipline, href, image, ...feature }] : [],
  );

  return (
    <>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }} />

        <section className={styles.intro} id="top" aria-labelledby="intro-title">
          <p className={styles.kicker}>AI developer in Bozeman, Montana</p>
          <h1 id="intro-title">I build research agents and retrieval systems that show their work.</h1>
          <p className={styles.lede}>
            Recent work includes an Obsidian agent that keeps a receipt for every tool call, and a retrieval pipeline that has emailed me a cited lesson twice a day since March.
          </p>
          <dl className={styles.facts}>
            <dt>Now</dt>
            <dd><a href={currentFocus.href}>{currentFocus.label}</a></dd>
            {availability ? (
              <>
                <dt>Open to</dt>
                <dd>{availability}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <WorkIndex projects={featured} />

        <section className={styles.section} id="more" aria-labelledby="more-title">
          <h2 className={styles.label} id="more-title">More projects</h2>
          <ul className={styles.rows}>
            {projects.slice(FEATURED_PROJECTS).map((project) => (
              <li key={project.slug}>
                <a href={`/work/${project.slug}/`}>
                  <span className={styles.rowTitle}>{project.title}</span>
                  <span className={styles.rowNote}>{project.tagline}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} id="writing" aria-labelledby="writing-title">
          <h2 className={styles.label} id="writing-title">Writing</h2>
          <div className={styles.content}>
            {latestPost ? (
              <a className={styles.post} href={`/blog/${latestPost.slug}/`}>
                <span className={styles.rowTitle}>{latestPost.title}</span>
                <span className={styles.rowNote}>{latestPost.summary}</span>
                <span className="writing-meta"><time dateTime={latestPost.publishedAt}>{formatDate(latestPost.publishedAt)}</time> · {latestPost.readingMinutes} min read</span>
              </a>
            ) : null}
            <a className={styles.textLink} href="/blog/">All writing</a>
          </div>
        </section>

        <section className={styles.section} id="activity" aria-labelledby="activity-title">
          <h2 className={styles.label} id="activity-title">Activity</h2>
          <div className={styles.content}>
            {calendar.summary ? (
              <p className={styles.statement}>
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
            <a className={styles.textLink} href="/activity/">How each number is counted</a>
          </div>
        </section>

        <section className={styles.section} id="about" aria-labelledby="about-title">
          <h2 className={styles.label} id="about-title">About</h2>
          <div className={styles.about}>
            <div className={styles.aboutCopy}>
              <p className={styles.statement}>
                I care about the parts of AI software that usually get skipped: the approval before a tool runs, the citation behind a sentence, the record you can replay when a step fails.
              </p>
              <p>I live in Bozeman. Away from the keyboard I&apos;m usually reading, fly fishing, hiking, or lifting.</p>
              <details className={styles.approach}>
                <summary>How I approach my work</summary>
                <p>I work across the stack, from data pipelines and evaluation to the tools people use.</p>
                <p>I like working on ambiguous problems. I read what exists, build a rough first version, and keep reshaping it until the system is something a person can understand and trust.</p>
                {interests.map(([title, description]) => <p key={title}><strong>{title}.</strong> {description}</p>)}
              </details>
            </div>
            <figure className={styles.photo}>
              <Image src="/images/hiking-valley.jpg" alt="A mountain valley between a shadowed rocky slope and a sunlit ridge, with open country in the distance" width={1280} height={960} sizes="(max-width: 760px) calc(100vw - 40px), 320px" />
            </figure>
          </div>
        </section>

        <section className={styles.section} id="contact" aria-labelledby="contact-title">
          <h2 className={styles.label} id="contact-title">Contact</h2>
          <div className={styles.content}>
            <p className={styles.statement}>If you&apos;re hiring for applied AI, or have a problem worth building for, I&apos;d be glad to hear about it.</p>
            <dl className={styles.channels}>
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
      </main>
      <SiteFooter />
    </>
  );
}
