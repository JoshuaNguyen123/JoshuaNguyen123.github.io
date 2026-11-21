import Image from "next/image";
import bands from "@/components/site/bands.module.css";
import { ArchitectureDiagram } from "@/components/work/ArchitectureDiagram";
import type { Project } from "@/content/projects";
import styles from "./WorkIndex.module.css";

export type FeaturedProject = Pick<Project, "slug" | "number" | "title" | "tagline" | "discipline" | "href" | "image" | "preview"> &
  NonNullable<Project["feature"]>;

/**
 * The three lead projects, each shown whole: a wide image (a product
 * screenshot where one exists, otherwise its architecture diagram),
 * then its stack, name, one line, three checkable facts, and its case study.
 * Nothing here needs JavaScript; every image and title is a native link.
 */
export function WorkIndex({ projects }: { projects: FeaturedProject[] }) {
  return (
    <section className={bands.band} id="work" aria-labelledby="work-title">
      <h2 className={bands.title} id="work-title">Selected work</h2>
      <div className={styles.rows}>
        {projects.map((project) => (
          <article key={project.slug} id={`project-${project.slug}`} className={styles.row} aria-labelledby={`project-${project.slug}-title`}>
            <a className={styles.figure} href={`/work/${project.slug}/`} aria-label={`See the ${project.title} case study`}>
              {project.preview ? (
                <Image src={project.preview.src} alt={project.preview.alt} width={project.preview.width} height={project.preview.height} sizes="(max-width: 860px) 92vw, 58vw" loading="lazy" />
              ) : (
                <ArchitectureDiagram slug={project.slug} label={`Architecture diagram of ${project.title}`} />
              )}
            </a>
            <div className={styles.copy}>
              <p className={bands.meta}>{project.number} · {project.discipline}</p>
              <h3 className={styles.title} id={`project-${project.slug}-title`} style={{ viewTransitionName: `project-${project.slug}` }}>
                <a href={`/work/${project.slug}/`}>{project.title}</a>
              </h3>
              <p className={styles.summary}>{project.tagline}.</p>
              <ul className={styles.highlights}>
                {project.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
              </ul>
              <a className={bands.cta} href={`/work/${project.slug}/`} aria-label={`${project.title} case study`}>Read the case study</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
