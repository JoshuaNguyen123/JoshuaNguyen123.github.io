import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProjectShowcase } from "@/components/work/ProjectShowcase";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { FEATURED_PROJECTS, projects, type Project } from "@/content/projects";
import { githubUrl, linkedInUrl, siteName, siteUrl } from "@/content/site";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import Image from "next/image";
import styles from "./studio.module.css";

function ProjectMeta({ project }: { project: Project }) {
  return (
    <div className="project-meta">
      <span>{project.discipline}</span>
      {project.href ? (
        <a className="project-link project-link--external" href={project.href} target="_blank" rel="noreferrer">View project</a>
      ) : (
        <span className="project-private">Private repository · <a href="#contact">ask me about it</a></span>
      )}
    </div>
  );
}

function ProjectEntry({ project, showMeta = false }: { project: Project; showMeta?: boolean }) {
  return (
    <article className={styles.project}>
      <a className={styles.projectHeading} href={`/work/${project.slug}/`} aria-label={`Read about ${project.title}`}>
        <span className={styles.number} aria-hidden="true">{project.number}</span>
        <div className={styles.projectCopy}>
          <h3>{project.title}</h3>
          <p>{project.problem}</p>
        </div>
        <ArrowRightIcon className={styles.projectArrow} size={20} aria-hidden="true" />
      </a>
      {showMeta ? <div className={styles.projectMetadata}><ProjectMeta project={project} /></div> : null}
    </article>
  );
}

const interests = [
  ["AI engineering", "Agents and retrieval systems that are grounded, observable, and worth trusting."],
  ["Software development", "Small, well-tested pieces with clear contracts and useful errors."],
  ["Systems engineering", "Pipelines, runners, and local-first tools that keep working when no one is watching."],
] as const;

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: siteName,
  url: siteUrl,
  image: `${siteUrl}/joshua-nguyen.jpg`,
  jobTitle: "Forward-deployed engineer and AI developer",
  address: { "@type": "PostalAddress", addressLocality: "Bozeman", addressRegion: "MT", addressCountry: "US" },
  sameAs: [githubUrl, linkedInUrl].filter(Boolean),
};

export default function Home() {
  const latestPost = getPublishedPosts()[0];

  return (
    <>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }} />

        <section className={styles.hero} id="top" aria-labelledby="intro-title">
          <figure className={styles.valley}>
            <Image src="/images/hiking-valley.jpg" alt="A mountain valley between a shadowed rocky slope and a sunlit ridge, with open country in the distance" width={1280} height={960} sizes="(max-width: 760px) calc(100vw - 48px), 1152px" preload />
          </figure>
          <h1 id="intro-title">AI tools for<br className={styles.titleBreak} /> research and learning.</h1>
          <p className={styles.lede}>Research agents, retrieval systems, and the software that makes them useful.</p>
          <div className={styles.introduction}>
            <Image className={styles.portrait} src="/joshua-nguyen.jpg" alt="Joshua Nguyen smiling outdoors by a lake" width={800} height={1000} sizes="64px" />
            <div className={styles.biography}>
              <p>I&apos;m Joshua, an AI developer and forward-deployed engineer based in Bozeman, Montana.</p>
            </div>
          </div>
          <a className={styles.workButton} href="#work">Explore my work<ArrowRightIcon size={20} aria-hidden="true" /></a>
        </section>

        <section className={styles.work} id="work" aria-labelledby="work-title">
          <h2 className={styles.sectionTitle} id="work-title">Selected work</h2>
          <ProjectShowcase projects={projects.slice(0, FEATURED_PROJECTS).map(({ slug, number, title, discipline }) => ({ slug, number, title, discipline }))} />
          <details className={styles.moreProjects}>
            <summary>More projects ({projects.length - FEATURED_PROJECTS})</summary>
            <div>
              {projects.slice(FEATURED_PROJECTS).map((project) => <ProjectEntry key={project.slug} project={project} showMeta />)}
            </div>
            <a className={styles.textLink} href={githubUrl} target="_blank" rel="noreferrer">See the rest on GitHub<ArrowRightIcon size={20} aria-hidden="true" /></a>
          </details>
        </section>

        <div className={styles.journal}>
          <section id="writing" aria-labelledby="writing-title">
            <h2 className={styles.eyebrow} id="writing-title">Writing</h2>
            {latestPost ? (
              <>
                <h3><a href={`/blog/${latestPost.slug}/`}>{latestPost.title}</a></h3>
                <p>{latestPost.summary}</p>
                <span className="writing-meta"><time dateTime={latestPost.publishedAt}>{formatDate(latestPost.publishedAt)}</time> · {latestPost.readingMinutes} min read</span>
                <a className={styles.textLink} href="/blog/">Explore the writing<ArrowRightIcon size={20} aria-hidden="true" /></a>
              </>
            ) : <a className={styles.textLink} href="/blog/">Explore the writing<ArrowRightIcon size={20} aria-hidden="true" /></a>}
          </section>
          <section id="activity" aria-labelledby="activity-title">
            <h2 className={styles.eyebrow} id="activity-title">Activity</h2>
            <h3>The work behind the work.</h3>
            <p>An ongoing record of what I&apos;m building, with the sources and context behind the numbers.</p>
            <a className={styles.textLink} href="/activity/">View activity<ArrowRightIcon size={20} aria-hidden="true" /></a>
          </section>
        </div>

        <section className={styles.about} id="about" aria-labelledby="about-title">
          <figure className={styles.goats}>
            <Image src="/images/hiking-goats.jpg" alt="Two mountain goats on a rocky slope above the valley in golden evening light" width={1280} height={960} sizes="(max-width: 760px) calc(100vw - 48px), 1152px" />
          </figure>
          <div className={styles.aboutCopy}>
            <h2 id="about-title">A little beyond the work.</h2>
            <p>Away from the keyboard, I&apos;m usually reading, fly fishing, hiking, or lifting.</p>
            <details className={styles.interests}>
              <summary>How I approach my work</summary>
              <p>I work across the stack, from data pipelines and evaluation to the tools people use.</p>
              <p>I like working on ambiguous problems. I read what exists, build a rough first version, and keep reshaping it until the system is something a person can understand and trust.</p>
              {interests.map(([title, description]) => <p key={title}><strong>{title}.</strong> {description}</p>)}
            </details>
          </div>
        </section>

        <section className={styles.contact} id="contact" aria-labelledby="contact-title">
          <div className={styles.contactCopy}>
            <h2 id="contact-title">Let&apos;s talk.</h2>
            <p>If you&apos;re building something thoughtful, or stuck on a tricky technical problem, I&apos;d be glad to hear about it.</p>
            <div className="contact-links">
              {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer">Contact me on LinkedIn<ArrowRightIcon size={20} aria-hidden="true" /></a> : <a href={githubUrl} target="_blank" rel="noreferrer">Find me on GitHub<ArrowRightIcon size={20} aria-hidden="true" /></a>}
            </div>
          </div>
          <ContactForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
