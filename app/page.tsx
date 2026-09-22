import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { FEATURED_PROJECTS, projects, type Project } from "@/content/projects";
import { githubUrl, linkedInUrl, siteName, siteUrl } from "@/content/site";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import { loadActivitySnapshot } from "@/lib/activity/load";
import Image from "next/image";
import Link from "next/link";

function ProjectTitle({ project }: { project: Project }) {
  return <Link href={`/work/${project.slug}/`}>{project.title}</Link>;
}

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

function ProjectEntry({ project }: { project: Project }) {
  return (
    <article className="project-entry">
      <h3><ProjectTitle project={project} /></h3>
      <div className="project-story">
        <p>{project.problem}</p>
        <ProjectMeta project={project} />
      </div>
      <Link className="project-case-link" href={`/work/${project.slug}/`} aria-label={`Read about ${project.title}`}>
        <ArrowRightIcon size={20} aria-hidden="true" />
      </Link>
    </article>
  );
}

const interests = [
  ["AI engineering", "Agents and retrieval systems that are grounded, observable, and worth trusting."],
  ["Software development", "Small, well-tested pieces with clear contracts and useful errors."],
  ["Systems engineering", "Pipelines, runners, and local-first tools that keep working when no one is watching."],
] as const;

// Structured data for search engines: the same public identity the page shows.
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
  const activity = loadActivitySnapshot();
  const posts = getPublishedPosts();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <script
          type="application/ld+json"
          // JSON.stringify output contains no user input; "<" is escaped so the
          // script body can never close itself early.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
        />

        <section className="hero" id="top">
          <div className="hero-portrait">
            <Image src="/joshua-nguyen.jpg" alt="Joshua Nguyen smiling outdoors by a lake" width={800} height={1000}
              sizes="(max-width: 640px) 140px, (max-width: 1000px) 30vw, 300px" preload />
          </div>
          <div className="hero-copy">
            <div className="hero-location">Bozeman, Montana</div>
            <h1>Engineering AI<br />systems.</h1>
            <p>I&apos;m Joshua, a forward-deployed engineer, AI developer, and technical researcher based in Bozeman, Montana.</p>
            <p>I work across the stack, from data pipelines and evaluation to the tools people use.</p>
            <div className="hero-actions">
              <a className="primary-link" href="#work">Explore my work<ArrowRightIcon size={20} aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section className="work-section" id="work">
          <div className="section-heading"><h2>Selected work</h2></div>
          <div className="project-ledger">
            {projects.slice(0, FEATURED_PROJECTS).map((project) => <ProjectEntry key={project.slug} project={project} />)}
          </div>
          <details className="more-projects">
            <summary>More projects ({projects.length - FEATURED_PROJECTS})</summary>
            <div className="project-grid">
              {projects.slice(FEATURED_PROJECTS).map((project) => <ProjectEntry key={project.slug} project={project} />)}
            </div>
            <p className="project-more"><a href={githubUrl} target="_blank" rel="noreferrer">See the rest on GitHub</a></p>
          </details>
        </section>

        <section className="writing-section home-writing" id="writing" aria-labelledby="home-writing-title">
          <header>
            <div>
              <h2 id="home-writing-title">Writing</h2>
            </div>
            <Link href="/blog/">All writing</Link>
          </header>
          {posts.length > 0 ? (
            <div className="writing-list">
              {posts.slice(0, 3).map((post) => (
                <Link href={`/blog/${post.slug}/`} key={post.slug}>
                  <h3>{post.title}</h3>
                  <p>{post.summary}</p>
                  <span className="writing-meta">
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time> · {post.readingMinutes} min read
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className="about-strip" id="about">
          <div className="about-copy">
            <h2>A little beyond the work.</h2>
            <p>I live in Bozeman, Montana. Away from the keyboard, I&apos;m usually reading, fly fishing, hiking, or lifting.</p>
            <details className="about-interests">
              <summary>How I approach my work</summary>
              <p>I like working on ambiguous problems. I read what exists, build a rough first version, and keep reshaping it until the system is something a person can understand and trust.</p>
              {interests.map(([title, description]) => <p key={title}><strong>{title}.</strong> {description}</p>)}
            </details>
          </div>
          <figure className="hike-goats">
            <Image src="/images/hiking-goats.jpg" alt="Two mountain goats on a rocky slope above the valley in golden evening light" width={1280} height={960} sizes="(max-width: 640px) calc(100vw - 40px), 460px" />
          </figure>
          <figure className="hike-valley">
            <Image src="/images/hiking-valley.jpg" alt="A mountain valley between a shadowed rocky slope and a sunlit ridge, with open country in the distance" width={1280} height={960} sizes="(max-width: 1000px) calc(100vw - 48px), 940px" />
            <figcaption>From a recent hike.</figcaption>
          </figure>
        </section>

        <section className="activity-section" id="activity">
          <ActivityDashboard initialData={activity} />
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-body">
            <div className="contact-copy">
              <h2>Let&apos;s talk.</h2>
              <p>
                If you&apos;re building something thoughtful, or stuck on a tricky
                technical problem, I&apos;d be glad to hear about it.
              </p>
              {/* The links live outside the form: ContactForm renders nothing when the
                  Web3Forms key is absent, and these should survive that. */}
              <div className="contact-links">
                <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
                {linkedInUrl ? (
                  <a href={linkedInUrl} target="_blank" rel="noreferrer">LinkedIn</a>
                ) : null}
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
