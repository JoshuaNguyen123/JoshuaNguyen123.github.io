import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { ContactForm } from "@/components/contact/ContactForm";
// LinkedIn pulse is paused for now. See notes/linkedin-pulse.md (local only).
// import { LinkedInWidget } from "@/components/social/LinkedInWidget";
import { linkedInProfileUrl } from "@/content/linkedin-posts";
import { getPublishedPosts } from "@/lib/blog";
import { loadActivitySnapshot } from "@/lib/activity/load";
import Image from "next/image";
import Link from "next/link";

// Ordered by technical depth; only the first SHOWN_PROJECTS render for now.
const SHOWN_PROJECTS = 3;
const projects = [
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
] as const;

const interests = [
  ["AI engineering", "Agents and retrieval systems that are grounded, observable, and worth trusting."],
  ["Software development", "Small, well-tested pieces with clear contracts and useful errors."],
  ["Systems engineering", "Pipelines, runners, and local-first tools that keep working when no one is watching."],
] as const;

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Writing", href: "/blog/" },
  { label: "Activity", href: "#activity" },
  { label: "Contact", href: "#contact" },
] as const;

function NavLink({ label, href }: { label: string; href: string }) {
  return href.startsWith("#") ? <a href={href}>{label}</a> : <Link href={href}>{label}</Link>;
}

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
          {navLinks.map((link) => <NavLink key={link.label} {...link} />)}
        </nav>
        <details className="mobile-nav">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {navLinks.map((link) => <NavLink key={link.label} {...link} />)}
          </nav>
        </details>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>FDE, AI Developer, and Technical Researcher.</h1>
          <p>
            I like building and testing systems across the stack—from data
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
          <span className="eyebrow">Working on</span>
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
          {projects.slice(0, SHOWN_PROJECTS).map((project) => {
            const body = (
              <>
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
                  {project.href
                    ? <strong><span>View project</span></strong>
                    : <strong className="is-private">Private repository</strong>}
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
        ) : (
          <div className="writing-preview">
            <p>Notes from building software, including the parts that looked easy right before they weren&apos;t.</p>
            <ul aria-label="Planned writing topics">
              <li>Reliable agents</li>
              <li>Privacy by design</li>
              <li>Building in public</li>
            </ul>
          </div>
        )}

        {/* LinkedIn pulse paused; see notes/linkedin-pulse.md */}
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
              <a href="https://github.com/JoshuaNguyen123" target="_blank" rel="noreferrer">GitHub</a>
              {linkedInProfileUrl ? (
                <a href={linkedInProfileUrl} target="_blank" rel="noreferrer">LinkedIn</a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Joshua Nguyen</span>
        <span>Built with Next.js, published on GitHub Pages</span>
      </footer>
    </main>
  );
}
