"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/content/projects";
import styles from "./WorkIndex.module.css";

export type FeaturedProject = Pick<Project, "slug" | "number" | "title" | "discipline" | "href" | "image"> &
  NonNullable<Project["feature"]>;

/** Fraction of the viewport height where an entry counts as being read. Shared with ScrollSections. */
export const READING_LINE = 0.4;

/**
 * Selected work with a scroll-linked index. The index column is sticky (CSS
 * only) and marks the project crossing the reading line; a rail fills as the
 * reader moves through the three entries. On a phone the index becomes a slim
 * sticky bar. Native scrolling is never intercepted, and without JavaScript the
 * index is still a plain list of in-page links.
 */
export function WorkIndex({ projects }: { projects: FeaturedProject[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const entries = Array.from(track.querySelectorAll<HTMLElement>("[data-project-index]"));

    // One measurement per frame drives both signals, so they always agree:
    // the active entry is the last one whose top has passed the reading line
    // (the first one while the reader is still above the section), and
    // progress is written straight to a CSS variable. setActive with an
    // unchanged index is a no-op, so React re-renders only on a real change.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      const rect = track.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
      section.style.setProperty("--work-progress", progress.toFixed(4));
      let next = 0;
      entries.forEach((entry, index) => {
        if (entry.getBoundingClientRect().top <= line) next = index;
      });
      setActive(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const current = projects[active] ?? projects[0];

  return (
    <section ref={sectionRef} className={styles.section} id="work" aria-labelledby="work-title">
      <div className={styles.aside}>
        <div className={styles.sticky}>
          <h2 className={styles.heading} id="work-title">Selected work</h2>
          <nav className={styles.index} aria-label="Selected projects">
            <span className={styles.rail} aria-hidden="true" />
            <ol className={styles.list}>
              {projects.map((project, index) => (
                <li key={project.slug}>
                  <a className={styles.link} href={`#project-${project.slug}`} aria-current={index === active ? "true" : undefined}>
                    <span className={styles.number}>{project.number}</span>
                    <span className={styles.linkTitle}>{project.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <a className={styles.more} href="#more">More projects</a>
        </div>
      </div>

      <div className={styles.track} ref={trackRef}>
        <div className={styles.bar} aria-hidden="true">
          <p>
            <span className={styles.number}>{current.number} / {String(projects.length).padStart(2, "0")}</span>
            <span className={styles.barTitle}>{current.title}</span>
          </p>
          <span className={styles.barTrack} />
        </div>

        {projects.map((project, index) => (
          <article
            key={project.slug}
            id={`project-${project.slug}`}
            className={styles.entry}
            data-project-index={index}
            aria-labelledby={`project-${project.slug}-title`}
          >
            <figure className={styles.figure}>
              <Image
                src={project.image}
                alt={`Architecture diagram of ${project.title}`}
                width={1200}
                height={900}
                sizes="(max-width: 760px) calc(100vw - 40px), 860px"
              />
            </figure>
            <p className={styles.meta}>{project.number} · {project.discipline}</p>
            <h3 className={styles.title} id={`project-${project.slug}-title`}>{project.title}</h3>
            <p className={styles.summary}>{project.summary}</p>
            <ul className={styles.highlights}>
              {project.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            </ul>
            <div className={styles.actions}>
              <a className={styles.caseStudy} href={`/work/${project.slug}/`}>Read the case study</a>
              {project.href ? (
                <a className="project-link project-link--external" href={project.href} target="_blank" rel="noreferrer">View the source</a>
              ) : (
                <span className={styles.private}>Private repository · <a href="#contact">ask me about it</a></span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
