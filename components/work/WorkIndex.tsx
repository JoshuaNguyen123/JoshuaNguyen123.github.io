"use client";

import Image from "next/image";
import { useState } from "react";
import type { Project } from "@/content/projects";
import styles from "./WorkIndex.module.css";

export type FeaturedProject = Pick<Project, "slug" | "number" | "title" | "tagline" | "discipline" | "href" | "image" | "preview"> &
  NonNullable<Project["feature"]>;

/**
 * Three lead projects: one shown large with its image, the others listed
 * beside it. Each listed entry has a button, labelled for what it shows, that
 * brings its screenshot or diagram into the large slot. All case studies
 * remain native links, including before hydration.
 */
export function WorkIndex({ projects }: { projects: FeaturedProject[] }) {
  const [active, setActive] = useState(0);

  return (
    <section className={styles.section} id="work" aria-labelledby="work-title">
      <h2 className={styles.heading} id="work-title">Selected work</h2>
      <div className={styles.track}>
        {projects.map((project, index) => (
          <article
            key={project.slug}
            id={`project-${project.slug}`}
            className={styles.entry}
            data-featured={active === index}
            aria-labelledby={`project-${project.slug}-title`}
          >
            <a className={styles.figure} href={`/work/${project.slug}/`} aria-label={`See the ${project.title} case study`}>
                <Image
                  src={project.preview?.src ?? project.image}
                  alt={project.preview?.alt ?? `Architecture diagram of ${project.title}`}
                  width={project.preview?.width ?? 1200}
                  height={project.preview?.height ?? 720}
                  sizes="(max-width: 760px) 90vw, 60vw"
                  loading="lazy"
                />
                <span className={styles.caption}>{project.preview?.caption ?? "System architecture"}</span>
            </a>
            <div className={styles.copy}>
              <h3 className={styles.title} id={`project-${project.slug}-title`}>
                <a href={`/work/${project.slug}/`}>{project.title}</a>
              </h3>
              <p className={styles.summary}>{project.tagline}.</p>
              <p className={styles.detail}>{project.highlights[0]}.</p>
              <div className={styles.actions}>
                <a className={styles.caseStudy} href={`/work/${project.slug}/`} aria-label={`${project.title} case study`}>Case study</a>
                <button
                  type="button"
                  className={styles.swap}
                  aria-label={`${project.preview ? "Show screenshot" : "Show diagram"} of ${project.title}`}
                  aria-pressed={active === index}
                  aria-controls={`project-${project.slug}`}
                  onClick={() => setActive(index)}
                >{project.preview ? "Show screenshot" : "Show diagram"}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
