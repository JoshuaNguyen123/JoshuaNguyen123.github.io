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

// Most impressive first. The first FEATURED_PROJECTS get the full entry with
// a reflection; the rest render as compact cards underneath.
const FEATURED_PROJECTS = 3;
const projects: Project[] = [
  {
    number: "01",
    title: "Obsidian Research Agent",
    description:
      "An Obsidian plugin that runs research missions inside a vault. It reads the vault for context, plans, uses approved tools, writes back to notes, and shows a receipt for every step. It also carries a bounded code workspace and gated Linear and GitHub integrations, with sandboxing, approval prompts, replay, and recovery when a step fails.",
    reflection:
      "Adding tools to an agent is the easy part. The hard part is making each one bounded and debuggable, so that when something goes wrong you can see exactly which call did it and run it again.",
    discipline: "TypeScript · Agent systems",
    href: "https://github.com/JoshuaNguyen123/Obsidian_research_agent",
  },
  {
    number: "02",
    title: "Research Agent Platform",
    description:
      "A standalone desktop editor built around the same agent core as the plugin. Electron and CodeMirror 6, fully compatible with Obsidian vaults, with the agent's edits reviewed hunk by hunk before anything touches disk. The core is vendored at a pinned commit behind three typed seams rather than forked. It ships as a Windows installer, with Playwright journeys covering the whole loop.",
    reflection:
      "Vendoring the core instead of forking it kept one agent with two hosts. The typed seams are the whole contract, so a vendor bump that breaks one fails at compile time instead of in someone's vault.",
    discipline: "TypeScript · Electron · Desktop app",
    href: null,
  },
  {
    number: "03",
    title: "Teach Anything",
    description:
      "An adaptive learning engine that plans each session from what the learner actually remembers. It combines FSRS-5 forgetting curves, Bayesian mastery estimates, and sandboxed code exercises on top of a deterministic core, so any schedule can be replayed against the learning history and checked. Every question cites its source.",
    reflection:
      "Getting a model to write a lesson takes an afternoon. Getting Tuesday's lesson to depend on what Monday showed, and being able to prove it, was the real product.",
    discipline: "TypeScript · Learning systems",
    href: null,
  },
  {
    number: "04",
    title: "Autonomous Repository Template",
    description:
      "A repository protocol for coding agents. Project memory lives in tracked files, implementation is blocked behind a planning gate, every task carries a verification lane, and features enter only through a human request. Products are instantiated from it and can migrate to newer protocol versions without losing their own state.",
    reflection:
      "An agent with good memory and a gate it cannot skip does more useful work than a smarter agent with neither.",
    discipline: "Python · Agent workflows",
    href: null,
  },
  {
    number: "05",
    title: "Great Outdoors Intelligence",
    description:
      "Ranks outdoor destinations in Montana by live conditions instead of showing a wall of gauges. It pulls forecasts, river gauges, avalanche advisories, snowpack, road status, and fire data, scores places per activity, and prepares trip bundles that work fully offline. In progress, built on the repository template above.",
    reflection:
      "The product is the ranking. The dashboard exists so you can argue with it.",
    discipline: "Python · Data pipelines",
    href: null,
  },
  {
    number: "06",
    title: "Personal AI Digest",
    description:
      "A self-hosted RAG pipeline that emails me a grounded technical lesson twice a day. Ingestion and delivery are separate services that share only the knowledge store, which can be SQLite or Postgres with pgvector.",
    reflection:
      "Requiring a citation for every generated sentence is what turned this from a toy into something I trust enough to study from.",
    discipline: "Python · RAG · Cloudflare Workers",
    href: null,
  },
  {
    number: "07",
    title: "Engineering Activity Portfolio",
    description:
      "This site. A privacy-safe collector reads local activity from the tools I work in, publishes daily counts to a live feed, and renders them as the yearly heatmaps above. Nothing about the code or the projects leaves the machine.",
    reflection:
      "Provenance and privacy work better as visible features than as a footnote.",
    discipline: "TypeScript · Data visualization",
    href: "https://github.com/JoshuaNguyen123/JoshuaNguyen123.github.io",
  },
  {
    number: "08",
    title: "Local-First Meeting Transcription",
    description:
      "A meeting recorder that never leaves the machine. Live transcription with Vosk, a refined pass with faster-whisper after the meeting, a review queue that reconciles the two, and structured notes from a local model. FastAPI backend, React frontend.",
    reflection:
      "Two transcripts of the same audio disagree constantly. The review queue that reconciles them turned out to be the product, not the models.",
    discipline: "Python · TypeScript · Speech",
    href: null,
  },
  {
    number: "09",
    title: "Ladybug",
    description:
      "A private photo and writing app for two people. I built it first as a deterministic product simulator, then as a Supabase-backed PWA alongside the original SwiftUI and Firebase app. The work covers access control, realtime state, uploads, and privacy.",
    reflection:
      "Two phones, two accounts, uploads, notifications, and realtime state make even a two-person app a small distributed system. The simulator let me find the product mistakes before paying for cloud time.",
    discipline: "TypeScript · Swift · Supabase",
    href: null,
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
