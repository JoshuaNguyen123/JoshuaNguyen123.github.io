import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ArchitectureDiagram } from "@/components/work/ArchitectureDiagram";
import { ProjectBrowser, type BrowserProject } from "@/components/work/ProjectBrowser";
import styles from "@/components/work/gallery.module.css";
import { getProjects } from "@/content/projects";
import { ogImage } from "@/content/site";
import type { Metadata } from "next";
import Image from "next/image";

const title = "Work";
const description = "Joshua Nguyen's projects, each with a case study and an architecture diagram.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/work/" },
  openGraph: { title, description, type: "website", url: "/work/", images: [ogImage] },
};

export default function WorkIndexPage() {
  const projects: BrowserProject[] = getProjects().map((project) => ({
    slug: project.slug,
    number: project.number,
    title: project.title,
    tagline: project.tagline,
    discipline: project.discipline,
    problem: project.problem,
    figure: project.preview ? (
      <Image src={project.preview.src} alt={project.preview.alt} width={project.preview.width} height={project.preview.height} sizes="(max-width: 960px) 92vw, 40vw" />
    ) : (
      <ArchitectureDiagram slug={project.slug} label={`Architecture diagram of ${project.title}`} />
    ),
  }));

  return (
    <>
      <SiteHeader current="work" variant="night" />
      <main className="night" id="main">
        <header className={styles.opening}>
          <p className={styles.meta}>Work · {projects.length} projects</p>
          <h1>Projects, and how each one was built.</h1>
          <p className={styles.lede}>Every project has a case study: what it does, how the pieces connect, what was hard, and what it taught me.</p>
        </header>
        <ProjectBrowser projects={projects} />
      </main>
      <SiteFooter />
    </>
  );
}
