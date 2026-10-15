import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/subpage.module.css";
import { getProject, getProjects } from "@/content/projects";
import { ogImage, siteName } from "@/content/site";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
            <Link className={styles.back} href="/#work">All work</Link>
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
                  <>Private repository · <Link href="/#contact">ask me about it</Link></>
                )}
              </dd>
            </dl>
          </header>

          <section className={styles.section}>
            <h2 className={styles.label}>What it does</h2>
            <p className={styles.prose}>{project.whatItDoes}</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.label}>Architecture</h2>
            <figure className={styles.figure}>
              <Image
                src={project.image}
                alt={`Architecture diagram of ${project.title}`}
                width={1200}
                height={900}
                sizes="(max-width: 760px) calc(100vw - 48px), 880px"
              />
              <figcaption>How the pieces connect, at a glance. <a href={project.image} target="_blank" rel="noreferrer">Open the full-size diagram (new tab)</a></figcaption>
            </figure>
          </section>

          {story.map(([heading, text]) => (
            <section className={styles.section} key={heading}>
              <h2 className={styles.label}>{heading}</h2>
              <p className={styles.prose}>{text}</p>
            </section>
          ))}

          <footer className={styles.section}>
            <h2 className={styles.label}>Next project</h2>
            <div className={styles.content}>
              <ul className={styles.rows}>
                <li>
                  <Link href={`/work/${next.slug}/`}>
                    <span className={styles.rowTitle}>{next.title}</span>
                    <span className={styles.rowNote}>{next.tagline}</span>
                  </Link>
                </li>
              </ul>
              <Link className={styles.textLink} href="/#work">All work</Link>
            </div>
          </footer>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
