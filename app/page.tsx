import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ContactForm } from "@/components/contact/ContactForm";
// LinkedIn pulse is paused for now. See notes/linkedin-pulse.md (local only).
// import { LinkedInWidget } from "@/components/social/LinkedInWidget";
import { linkedInProfileUrl } from "@/content/linkedin-posts";
import { getPublishedPosts } from "@/lib/blog";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import type { ActivitySnapshot } from "@/lib/activity/types";
import { readFileSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";

function loadActivitySnapshot(): ActivitySnapshot {
  const snapshotPath = path.join(process.cwd(), "public", "data", "activity.json");
  const snapshot = parseActivitySnapshot(JSON.parse(readFileSync(snapshotPath, "utf8")));
  if (!snapshot) throw new Error("Bundled activity snapshot failed runtime validation");
  return snapshot;
}

// Ordered by technical depth; only the first SHOWN_PROJECTS render for now.
const SHOWN_PROJECTS = 3;
const projects = [
  {
    number: "01",
    title: "Obsidian Research Agent",
    description:
      "An Obsidian agent for research, writing, and bounded engineering work.",
    reflection:
      "Autonomy becomes useful when people can see the plan, the tools, and the receipts.",
    discipline: "TypeScript · Agent systems",
    href: "https://github.com/JoshuaNguyen123/Obsidian_research_agent",
  },
  {
    number: "02",
    title: "Ladybug",
    description:
      "A private photo-and-writing ritual for two people: a deterministic product simulator, a Supabase-backed PWA, and the original SwiftUI and Firebase app.",
    reflection:
      "A deterministic simulator let me verify the whole product on Windows before spending anything on cloud.",
    discipline: "TypeScript · Swift · Supabase",
    href: null,
  },
  {
    number: "03",
    title: "Teach Anything",
    description:
      "An adaptive learning engine that recomputes each day's session from the learner's memory state. FSRS-5 for forgetting, Beta posteriors per mastery level, and a pure engine with no I/O enforced by lint.",
    reflection:
      "Keeping the adaptive core deterministic made it replayable against real history, which is the only way to know if it beats a static schedule.",
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
] as const;

const interests = [
  ["AI engineering", "Agents and retrieval systems that are grounded, observable, and worth trusting."],
  ["Software development", "Small, well-tested pieces with clear contracts and useful errors."],
  ["Systems engineering", "Pipelines, runners, and local-first tools that keep working when no one is watching."],
] as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function Home() {
  const activity = loadActivitySnapshot();
  const posts = getPublishedPosts();

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Joshua Nguyen home">
          Joshua Nguyen
        </a>
        <nav aria-label="Primary navigation">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <Link href="/blog/">Writing</Link>
          <a href="#activity">Activity</a>
          <a href="#contact">Contact</a>
        </nav>
        <details className="mobile-nav">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            <a href="#about">About</a>
            <a href="#work">Work</a>
            <Link href="/blog/">Writing</Link>
            <a href="#activity">Activity</a>
            <a href="#contact">Contact</a>
          </nav>
        </details>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Joshua Nguyen</span>
          <h1>FDE, AI developer, and technical researcher.</h1>
          <p>
            I like turning ideas into useful software, learning as I go, and helping
            people through the tricky technical parts.
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
        <div className="hero-side">
          <div className="hero-portrait">
            <Image
              src="/joshua-nguyen.jpg"
              alt="Joshua Nguyen smiling outdoors by a lake"
              width={800}
              height={1000}
              sizes="(max-width: 680px) calc(100vw - 40px), (max-width: 1000px) 38vw, 360px"
              priority
            />
          </div>
        </div>
      </section>

      <section className="about-strip" id="about">
        <span className="eyebrow">About</span>
        <div className="about-copy">
          <p>I like working on ambiguous problems.</p>
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
      </section>

      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="eyebrow">Projects</span>
          <h2>Things I&apos;ve built.</h2>
        </div>
        <div className="project-ledger">
          {projects.slice(0, SHOWN_PROJECTS).map((project) => {
            const body = (
              <>
                <span className="project-number">{project.number}</span>
                <div className="project-story">
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <p className="project-reflection">
                    <span>What it taught me</span>
                    {project.reflection}
                  </p>
                </div>
                <div className="project-meta">
                  <span>{project.discipline}</span>
                  <strong>{project.href ? "View project" : "Private repository"}</strong>
                </div>
              </>
            );
            return project.href ? (
              <a href={project.href} key={project.title} target="_blank" rel="noreferrer">{body}</a>
            ) : (
              <article key={project.title}>{body}</article>
            );
          })}
        </div>
      </section>

      <section className="interests-section" id="interests">
        <div className="section-heading section-heading--compact">
          <span className="eyebrow">Interests</span>
          <h2>What I&apos;m exploring.</h2>
        </div>
        <div className="interest-columns">
          {interests.map(([title, description], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <section className="home-writing" aria-labelledby="home-writing-title">
          <header>
            <div>
              <span className="eyebrow">Writing</span>
              <h2 id="home-writing-title">Notes.</h2>
            </div>
            <Link href="/blog/">Visit the notebook</Link>
          </header>
          {posts.length > 0 ? (
            <div className="writing-list">
              {posts.slice(0, 3).map((post) => (
                <Link href={`/blog/${post.slug}/`} key={post.slug}>
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  <div><h3>{post.title}</h3><p>{post.summary}</p></div>
                  <span>{post.readingMinutes} min read</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="writing-preview">
              <p>
                Short notes on what I build and learn.
              </p>
              <ul aria-label="Planned writing topics">
                <li>Reliable agents</li>
                <li>Privacy by design</li>
                <li>Building in public</li>
              </ul>
            </div>
          )}
        </section>

        {/* LinkedIn pulse paused; see notes/linkedin-pulse.md */}
      </section>

      <section className="activity-section" id="activity">
        <ActivityDashboard initialData={activity} />
      </section>

      <section className="contact-section" id="contact">
        <span className="eyebrow">Contact</span>
        <div>
          <h2>Let&apos;s talk.</h2>
          <p>
            If you&apos;re building something thoughtful, or stuck on a tricky
            technical problem, I&apos;d be glad to hear about it.
          </p>
          <ContactForm />
          <div className="contact-links">
            {linkedInProfileUrl ? (
              <a href={linkedInProfileUrl} target="_blank" rel="noreferrer">LinkedIn</a>
            ) : null}
            <a href="https://github.com/JoshuaNguyen123" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Joshua Nguyen</span>
      </footer>
    </main>
  );
}
