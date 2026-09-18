import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProjectTile } from "@/components/work/ProjectTile";
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
      {/* The typographic tile already carries the discipline; a diagram does not. */}
      {project.image ? <span>{project.discipline}</span> : null}
      {project.href ? (
        <a className="project-link project-link--external" href={project.href} target="_blank" rel="noreferrer">View project</a>
      ) : (
        <span className="project-private">Private repository · <a href="#contact">ask me about it</a></span>
      )}
    </div>
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
          <div className="hero-copy">
            <h1>Forward-deployed engineer, AI developer, and technical researcher.</h1>
            <p>
              I like building and testing systems across the stack, from data
              pipelines and evaluation harnesses to small language models, RAG,
              MCP tools, and the product layer that has to make them useful.
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="#work">See what I&apos;m building</a>
              <Link className="text-link" href="/blog/">Read my notes</Link>
            </div>
            <dl className="hero-now" aria-label="About Joshua right now">
              <div><dt>Now</dt><dd>Building with AI</dd></div>
              <div><dt>Interested in</dt><dd>AI engineering, software development, systems engineering</dd></div>
              <div><dt>Based in</dt><dd>Bozeman, Montana</dd></div>
            </dl>
          </div>
          <div className="hero-portrait">
            <Image
              src="/joshua-nguyen.jpg"
              alt="Joshua Nguyen smiling outdoors by a lake"
              width={800}
              height={1000}
              sizes="(max-width: 760px) calc(100vw - 40px), 384px"
              priority
            />
          </div>
        </section>

        <section className="about-strip" id="about">
          <div className="about-copy">
            <span className="eyebrow">About</span>
            <h2>I like working on ambiguous problems.</h2>
            <p>
              The part I enjoy most is when nobody is quite sure what the right
              answer is yet. I read what exists, build a rough first version, and
              keep reshaping it until the system is something a person can
              understand and trust. Lately that has meant retrieval pipelines,
              agents with real guardrails, and local-first tools that respect
              people&apos;s data.
            </p>
            <p>
              I live in Bozeman, Montana. When I&apos;m not at a keyboard I&apos;m
              usually reading, fly fishing, hiking, or lifting. I also keep a long
              Duolingo streak alive, which probably says something about how I
              approach most things.
            </p>
          </div>
          <div className="about-aside">
            <span className="eyebrow">Interested in</span>
            {interests.map(([title, description]) => (
              <p key={title}><strong>{title}.</strong> {description}</p>
            ))}
          </div>
        </section>

        <section className="work-section" id="work">
          <div className="section-heading">
            <span className="eyebrow">Work</span>
            <h2>Things I&apos;ve built.</h2>
          </div>
          <div className="project-ledger">
            {projects.slice(0, FEATURED_PROJECTS).map((project) => (
              <article className="project-entry" key={project.title}>
                <div className="project-story">
                  <h3><ProjectTitle project={project} /></h3>
                  <p>{project.description}</p>
                  <p className="project-reflection">
                    <span>What it taught me</span>
                    {project.reflection}
                  </p>
                </div>
                <div className="project-aside">
                  <Link href={`/work/${project.slug}/`} className="project-tile-link" aria-label={`Open the ${project.title} case study`}>
                    <ProjectTile number={project.number} title={project.title} discipline={project.discipline} image={project.image} />
                  </Link>
                  <ProjectMeta project={project} />
                </div>
              </article>
            ))}
          </div>
          <div className="project-grid-heading">
            <span className="eyebrow">More work</span>
          </div>
          <div className="project-grid">
            {projects.slice(FEATURED_PROJECTS).map((project) => (
              <article className="project-card" key={project.title}>
                <Link href={`/work/${project.slug}/`} className="project-tile-link" aria-label={`Open the ${project.title} case study`}>
                  <ProjectTile number={project.number} title={project.title} discipline={project.discipline} image={project.image} />
                </Link>
                <h3><ProjectTitle project={project} /></h3>
                <p>{project.description}</p>
                <ProjectMeta project={project} />
              </article>
            ))}
          </div>
          <p className="project-more">
            <a href="https://github.com/JoshuaNguyen123" target="_blank" rel="noreferrer">
              See the rest on GitHub
            </a>
          </p>
        </section>

        <section className="activity-section" id="activity">
          <ActivityDashboard initialData={activity} />
        </section>

        <section className="writing-section home-writing" aria-labelledby="home-writing-title">
          <header>
            <div>
              <span className="eyebrow">Writing</span>
              <h2 id="home-writing-title">Read my notes.</h2>
            </div>
            <Link href="/blog/">Open the notebook</Link>
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

        <section className="contact-section" id="contact">
          <div className="contact-body">
            <div className="contact-copy">
              <span className="eyebrow">Contact</span>
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
