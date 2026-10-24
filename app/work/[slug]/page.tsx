import { SiteFooter } from "@/components/site/SiteFooter";
import { ArchitectureDiagram } from "@/components/work/ArchitectureDiagram";
import { ScrollSections } from "@/components/site/ScrollSections";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/subpage.module.css";
import { getProject, getProjects } from "@/content/projects";
import { ogImage, siteName } from "@/content/site";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return getProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.problem,
    alternates: { canonical: `/work/${project.slug}/` },
    openGraph: {
      title: project.title,
      description: project.problem,
      type: "article",
      url: `/work/${project.slug}/`,
      authors: [siteName],
      images: [ogImage],
    },
  };
}

export default async function WorkCaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const all = getProjects();
  const next = all[(all.indexOf(project) + 1) % all.length];
  const story = [
    ["How the pieces connect", project.howItConnects],
    ["What was hard", project.whatWasHard],
    ["What it taught me", project.reflection],
  ] as const;

  return (
    <>
      <SiteHeader current="work" />
      <main className={styles.main} id="main">
        <article>
          <header className={styles.intro}>
            <a className={styles.back} href="/#work">All work</a>
            <p className={styles.kicker}>Project {project.number}</p>
            <h1>{project.title}</h1>
            <p className={styles.lede}>{project.problem}</p>
            <dl className={styles.facts}>
              <dt>Discipline</dt>
              <dd>{project.discipline}</dd>
              <dt>Repository</dt>
              <dd>
                {project.href ? (
                  <a className={styles.link} href={project.href} target="_blank" rel="noreferrer">View repository</a>
                ) : (
                  <>Private repository · <a href="/#contact">ask me about it</a></>
                )}
              </dd>
            </dl>
          </header>

          <ScrollSections>
            {project.preview ? (
              <section className={styles.section} data-section="Inside the app">
                <h2 className={styles.label} data-section-label>Inside the app</h2>
                <figure className={styles.figure}>
                  <a href={project.preview.src} target="_blank" rel="noreferrer" aria-label="Open the full-size product capture (new tab)">
                    <Image src={project.preview.src} alt={project.preview.alt} width={project.preview.width} height={project.preview.height} sizes="(max-width: 760px) 90vw, 75vw" />
                  </a>
                  <figcaption>{project.preview.caption}. Open the image to explore it at full size.</figcaption>
                </figure>
              </section>
            ) : null}
            <section className={styles.section} data-section="What it does">
              <h2 className={styles.label} data-section-label>What it does</h2>
              <p className={styles.prose}>{project.whatItDoes}</p>
            </section>

            <section className={styles.section} data-section="Architecture">
              <h2 className={styles.label} data-section-label>Architecture</h2>
              <figure className={styles.figure}>
                <ArchitectureDiagram slug={project.slug} label={`Architecture diagram of ${project.title}`} />
                <figcaption>How the pieces connect, at a glance. <a href={project.image} target="_blank" rel="noreferrer">Open the full-size diagram (new tab)</a></figcaption>
              </figure>
            </section>

            {story.map(([heading, text]) => (
              <section className={styles.section} key={heading} data-section={heading}>
                <h2 className={styles.label} data-section-label>{heading}</h2>
                <p className={styles.prose}>{text}</p>
              </section>
            ))}
          </ScrollSections>

          <footer className={styles.section}>
            <h2 className={styles.label}>Next project</h2>
            <div className={styles.content}>
              <ul className={styles.rows}>
                <li>
                  <a href={`/work/${next.slug}/`}>
                    <span className={styles.rowTitle}>{next.title}</span>
                    <span className={styles.rowNote}>{next.tagline}</span>
                  </a>
                </li>
              </ul>
              <a className={styles.textLink} href="/#work">All work</a>
            </div>
          </footer>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
