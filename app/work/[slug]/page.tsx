import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
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

  return (
    <>
      <SiteHeader current="work" />
      <main className="blog-shell blog-article work-article" id="main">
        <article>
          <header className="article-header">
            <Link className="blog-back" href="/#work">All work</Link>
            <span className="eyebrow">{project.discipline}</span>
            <h1>{project.title}</h1>
            <p>{project.problem}</p>
          </header>
          <figure className="work-diagram">
            <Image
              src={project.image}
              alt={`Architecture diagram of ${project.title}`}
              width={1200}
              height={900}
              sizes="(max-width: 760px) calc(100vw - 40px), 760px"
            />
            <figcaption>How the pieces connect, at a glance.</figcaption>
          </figure>
          <div className="article-body">
            <h2>What it does</h2>
            <p>{project.whatItDoes}</p>
            <h2>How the pieces connect</h2>
            <p>{project.howItConnects}</p>
            <h2>What was hard</h2>
            <p>{project.whatWasHard}</p>
            <h2>What it taught me</h2>
            <p>{project.reflection}</p>
          </div>
          <footer className="article-footer work-footer">
            <span className="eyebrow">The repository</span>
            {project.href ? (
              <a className="project-link project-link--external" href={project.href} target="_blank" rel="noreferrer">
                View repository
              </a>
            ) : (
              <p className="project-private">Private repository · <Link href="/#contact">ask me about it</Link></p>
            )}
            <Link href="/#work">All work</Link>
          </footer>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
