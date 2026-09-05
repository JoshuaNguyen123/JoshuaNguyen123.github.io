import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProjectTile } from "@/components/work/ProjectTile";
import { githubUrl, linkedInUrl, siteName, siteUrl } from "@/content/site";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import { loadActivitySnapshot } from "@/lib/activity/load";
import Image from "next/image";
import Link from "next/link";

interface Project {
  number: string;
  title: string;
  description: string;
  reflection: string;
  discipline: string;
  href: string | null;
  /** Optional screenshot under public/, e.g. "/projects/ladybug.jpg". */
  image?: string;
}

// Ordered by technical depth. The first FEATURED_PROJECTS get the full entry
// with a reflection; the rest render as compact cards underneath.
const FEATURED_PROJECTS = 3;
const projects: Project[] = [
  {
    number: "01",
    title: "Obsidian Research Agent",
    description:
      "An Obsidian-native agent that can research, plan, use real tools, and write back to a vault while showing exactly what it did. I built the less glamorous parts too: sandboxing, approvals, replay, failure recovery, and receipts.",
    reflection:
      "Giving an agent more tools is easy. Making every tool real, bounded, and debuggable is the work. Also, autonomous is a very confident word for software that can still lose an argument with malformed JSON.",
    discipline: "TypeScript · Agent systems",
    href: "https://github.com/JoshuaNguyen123/Obsidian_research_agent",
  },
  {
    number: "02",
    title: "Ladybug",
    description:
      "A private photo-and-writing ritual for exactly two people, built first as a deterministic product simulator, then as a Supabase-backed PWA alongside the original SwiftUI and Firebase app. The work spans access control, realtime state, uploads, privacy, and the small interactions that make a shared space feel personal.",
    reflection:
      "A two-person app sounds small until two phones, two accounts, uploads, notifications, realtime state, and feelings become one distributed system. The simulator saved me from paying cloud bills to discover basic product mistakes.",
    discipline: "TypeScript · Swift · Supabase",
    href: null,
  },
  {
    number: "03",
    title: "Teach Anything",
    description:
      "An adaptive learning engine that recomputes each session from the learner's actual memory state. It combines FSRS-5 forgetting curves, Beta posteriors by mastery level, sandboxed code exercises, and a deterministic core that can be replayed against learning history instead of merely claiming to adapt.",
    reflection:
      "Asking an LLM for a lesson is easy. Making Tuesday remember what Monday taught, and proving the schedule adapts instead of improvises, is the actual product.",
    discipline: "TypeScript · Learning systems",
    href: null,
  },
  {
    number: "04",
    title: "Personal AI Digest",
    description:
      "A self-hosted RAG pipeline that emails a grounded technical lesson twice a day. Ingest and delivery are fully decoupled and share only the knowledge store (SQLite, or Postgres with pgvector).",
    reflection:
      "Grounding every generated sentence in a citation is what turns an LLM toy into something I trust enough to study from.",
    discipline: "Python · RAG · Cloudflare Workers",
    href: null,
  },
  {
    number: "05",
    title: "Vault AI Toolkit",
    description:
      "Local search, live graphs, and grounded Q&A over Obsidian vaults, with a sidebar plugin and an MCP server so Cursor and Codex can pull vault context while coding.",
    reflection:
      "Read-only by default, audit-logged writes, and nothing leaves the machine. Privacy is a feature people can feel.",
    discipline: "Python · TypeScript · MCP",
    href: null,
  },
  {
    number: "06",
    title: "Private Code Review Bot",
    description:
      "A stateless, comment-only PR reviewer for private repos on a self-hosted GitHub Actions runner. Deterministic scoring rubric, CI signal ingestion, and an optional free-tier LLM narrative.",
    reflection:
      "Running git as argv lists instead of shell strings is boring, and boring is exactly what you want when refs come from the environment.",
    discipline: "Python · GitHub Actions",
    href: null,
  },
  {
    number: "07",
    title: "Engineering Activity Portfolio",
    description:
      "This site: privacy-safe local activity collection, a live aggregate feed, and interactive yearly heatmaps.",
    reflection:
      "Privacy and data provenance should feel like product features, not footnotes.",
    discipline: "TypeScript · Data visualization",
    href: "https://github.com/JoshuaNguyen123/JoshuaNguyen123.github.io",
  },
  {
    number: "08",
    title: "Environmental Quality ML Dashboard",
    description:
      "An air-quality ML pipeline with reproducible training and a Streamlit dashboard.",
    reflection:
      "Model comparisons matter most when the results become understandable and usable.",
    discipline: "Python · Machine learning",
    href: "https://github.com/JoshuaNguyen123/environmental-quality-ml-dashboard",
  },
  {
    number: "09",
    title: "Book Service API",
    description:
      "A FastAPI service with search, ISBN lookup, web import, and local AI enrichment.",
    reflection:
      "Predictable contracts and useful errors matter more than an oversized feature list.",
    discipline: "Python · API design",
    href: "https://github.com/JoshuaNguyen123/book_service_api",
  },
];

function ProjectTitle({ project }: { project: Project }) {
  return project.href
    ? <a href={project.href} target="_blank" rel="noreferrer">{project.title}</a>
    : <>{project.title}</>;
}

function ProjectMeta({ project }: { project: Project }) {
  return (
    <div className="project-meta">
      {/* The typographic tile already carries the discipline; a screenshot does not. */}
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
              I like building and testing systems across the stack — from data
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
              <p key={title}>{title} — {description}</p>
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
                  <ProjectTile number={project.number} title={project.title} discipline={project.discipline} image={project.image} />
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
                <ProjectTile number={project.number} title={project.title} discipline={project.discipline} image={project.image} />
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
                  <div>
                    <h3>{post.title}</h3>
                    <p>{post.summary}</p>
                  </div>
                  <div>
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                    <span>{post.readingMinutes} min read</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className="contact-section" id="contact">
          <div>
            <span className="eyebrow">Contact</span>
            <h2>Let&apos;s talk.</h2>
            <p>
              If you&apos;re building something thoughtful, or stuck on a tricky
              technical problem, I&apos;d be glad to hear about it.
            </p>
            {/* The links live outside the form: ContactForm renders nothing when the
                Web3Forms key is absent, and these should survive that. */}
            <div className="contact-body">
              <ContactForm />
              <div className="contact-links">
                <span className="eyebrow">Elsewhere</span>
                <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
                {linkedInUrl ? (
                  <a href={linkedInUrl} target="_blank" rel="noreferrer">LinkedIn</a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
