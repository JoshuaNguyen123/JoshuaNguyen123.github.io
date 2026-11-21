"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { READING_LINE } from "@/lib/scroll";
import styles from "./gallery.module.css";

export interface BrowserProject {
  slug: string;
  number: string;
  title: string;
  tagline: string;
  discipline: string;
  problem: string;
  /** The project's screenshot or inlined architecture diagram, rendered on the server. */
  figure: ReactNode;
}

/**
 * The work index. Titles run down the left; on a wide screen one stage stays in
 * view on the right and shows the project being read, following the reading
 * line as the page scrolls and the pointer or keyboard as a title is reached.
 * On a narrow screen each project simply carries its own plate. Scrolling is
 * never intercepted, and every title and plate is a native link, so the page
 * works before hydration and without JavaScript.
 */
export function ProjectBrowser({ projects }: { projects: BrowserProject[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      const items = Array.from(root.querySelectorAll<HTMLElement>("[data-project-item]"));
      // The last title whose top has reached the reading line is the one being read.
      let current = 0;
      items.forEach((item, index) => {
        if (item.getBoundingClientRect().top <= line) current = index;
      });
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.browser} style={{ "--count": projects.length } as CSSProperties}>
      {projects.map((project, index) => (
        <Fragment key={project.slug}>
          <article
            className={styles.item}
            data-project-item=""
            data-active={active === index}
            aria-labelledby={`work-${project.slug}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
          >
            <p className={styles.meta}>{project.number} · {project.discipline}</p>
            {/* The name sits on the heading, a single box: a browser will not animate a link that wraps onto two lines. */}
            <h2 className={styles.title} id={`work-${project.slug}`} style={{ viewTransitionName: `project-${project.slug}` }}>
              <a href={`/work/${project.slug}/`}>{project.title}</a>
            </h2>
            <p className={styles.tagline}>{project.tagline}.</p>
          </article>
          <div className={styles.panel} data-active={active === index}>
            <a className={styles.plate} href={`/work/${project.slug}/`} aria-label={`See the ${project.title} case study`}>
              {project.figure}
            </a>
            <p className={styles.problem}>{project.problem}</p>
            <a className={styles.cta} href={`/work/${project.slug}/`} aria-label={`${project.title} case study`}>Read the case study</a>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
