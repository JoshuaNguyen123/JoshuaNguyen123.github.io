import { SiteFooter } from "@/components/site/SiteFooter";
import { ArchitectureDiagram } from "@/components/work/ArchitectureDiagram";
import { ScrollSections } from "@/components/site/ScrollSections";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ChapterRail, type Chapter } from "@/components/work/ChapterRail";
import styles from "@/components/work/gallery.module.css";
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
  const position = all.indexOf(project);
  const previous = all[(position - 1 + all.length) % all.length];
  const next = all[(position + 1) % all.length];
  const story = [
    ["how-the-pieces-connect", "How the pieces connect", project.howItConnects],
    ["what-was-hard", "What was hard", project.whatWasHard],
  ] as const;
  const chapters: Chapter[] = [
    ...(project.feature ? [{ id: "at-a-glance", label: "At a glance" }] : []),
    { id: "what-it-does", label: "What it does" },
    { id: "architecture", label: "Architecture" },
    ...story.map(([id, label]) => ({ id, label })),
    { id: "what-it-taught-me", label: "What it taught me" },
  ];

  return (
    <>
      <SiteHeader current="work" variant="night" />
      <main id="main">
        <article>
          <header className={`night ${styles.opening}${project.preview ? ` ${styles.withLead}` : ""}`}>
            <a className={styles.back} href="/work/">All work</a>
            <p className={styles.meta}>Case study · {project.number} of {String(all.length).padStart(2, "0")}</p>
            <h1 style={{ viewTransitionName: `project-${project.slug}` }}>{project.title}</h1>
            <p className={styles.lede}>{project.problem}</p>
            <dl className={styles.spec}>
              <div>
                <dt>Built with</dt>
                <dd>{project.discipline}</dd>
              </div>
              <div>
                <dt>Repository</dt>
                <dd>
                  {project.href ? (
                    <a href={project.href} target="_blank" rel="noreferrer">View repository</a>
                  ) : (
                    <>Private repository · <a href="/#contact">ask me about it</a></>
                  )}
                </dd>
              </div>
              <div>
                <dt>In one line</dt>
                <dd>{project.tagline}.</dd>
              </div>
            </dl>
          </header>

          {project.preview ? (
            <figure className={styles.lead}>
              <a href={project.preview.src} target="_blank" rel="noreferrer" aria-label="Open the full-size product capture (new tab)">
                <Image src={project.preview.src} alt={project.preview.alt} width={project.preview.width} height={project.preview.height} sizes="(max-width: 760px) 92vw, 84vw" preload />
              </a>
              <figcaption className={styles.caption}>{project.preview.caption}. Open the image to explore it at full size.</figcaption>
            </figure>
          ) : null}

          <div className={styles.body}>
            <ChapterRail chapters={chapters} />
            <ScrollSections>
              {project.feature ? (
                <section className={styles.chapter} id="at-a-glance" data-section="At a glance" aria-labelledby="at-a-glance-title">
                  <h2 id="at-a-glance-title">At a glance</h2>
                  <ol className={styles.glance}>
                    {project.feature.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                  </ol>
                </section>
              ) : null}

              <section className={styles.chapter} id="what-it-does" data-section="What it does" aria-labelledby="what-it-does-title">
                <h2 id="what-it-does-title">What it does</h2>
                <p className={styles.prose}>{project.whatItDoes}</p>
              </section>

              <section className={styles.chapter} id="architecture" data-section="Architecture" aria-labelledby="architecture-title">
                <h2 id="architecture-title">Architecture</h2>
                <figure className={styles.figure}>
                  <ArchitectureDiagram slug={project.slug} label={`Architecture diagram of ${project.title}`} />
                  <figcaption className={styles.caption}>How the pieces connect, at a glance. <a href={project.image} target="_blank" rel="noreferrer">Open the full-size diagram (new tab)</a></figcaption>
                </figure>
              </section>

              {story.map(([id, heading, text]) => (
                <section className={styles.chapter} key={id} id={id} data-section={heading} aria-labelledby={`${id}-title`}>
                  <h2 id={`${id}-title`}>{heading}</h2>
                  <p className={styles.prose}>{text}</p>
                </section>
              ))}
            </ScrollSections>
          </div>

          <section className={`night ${styles.reflection}`} id="what-it-taught-me" aria-labelledby="what-it-taught-me-title">
            <h2 id="what-it-taught-me-title">What it taught me</h2>
            <p>{project.reflection}</p>
          </section>

          <footer className="night">
            <nav className={styles.pager} aria-label="More projects">
              <a href={`/work/${previous.slug}/`}>
                <span className={styles.meta}>Previous project · {previous.number}</span>
                <span className={styles.pagerTitle}>{previous.title}</span>
                <span className={styles.pagerNote}>{previous.tagline}</span>
              </a>
              <a href={`/work/${next.slug}/`}>
                <span className={styles.meta}>Next project · {next.number}</span>
                <span className={styles.pagerTitle}>{next.title}</span>
                <span className={styles.pagerNote}>{next.tagline}</span>
              </a>
            </nav>
            <a className={styles.cta} href="/work/">All work</a>
          </footer>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
