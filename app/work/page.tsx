import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/frame.module.css";
import { FEATURED_PROJECTS, getProjects } from "@/content/projects";
import { ogImage } from "@/content/site";
import type { Metadata } from "next";

const title = "Work";
const description = "Joshua Nguyen's projects, each with a case study and an architecture diagram.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/work/" },
  openGraph: { title, description, type: "website", url: "/work/", images: [ogImage] },
};

export default function WorkIndexPage() {
  const projects = getProjects();
  // The same split as the homepage: the lead projects, then the rest.
  const groups = [
    ["Selected work", projects.slice(0, FEATURED_PROJECTS)],
    ["More projects", projects.slice(FEATURED_PROJECTS)],
  ] as const;

  return (
    <>
      <SiteHeader current="work" />
      <main className={styles.main} id="main">
        <header className={styles.intro}>
          <p className={styles.kicker}>Work</p>
          <h1>Projects, and how each one was built.</h1>
          <p className={styles.lede}>Every project has a case study: what it does, how the pieces connect, what was hard, and what it taught me.</p>
        </header>

        {groups.map(([heading, group], index) => (
          <section className={styles.section} key={heading} aria-labelledby={`work-group-${index}`}>
            <h2 className={styles.label} id={`work-group-${index}`}>{heading}</h2>
            <div className="writing-list">
              {group.map((project) => (
                <a href={`/work/${project.slug}/`} key={project.slug}>
                  <h3>{project.title}</h3>
                  <p>{project.feature?.summary ?? `${project.tagline}.`}</p>
                  <span className="writing-meta">{project.discipline}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
