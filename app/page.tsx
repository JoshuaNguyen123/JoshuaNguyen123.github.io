import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { LinkedInWidget } from "@/components/social/LinkedInWidget";
import { linkedInPosts, linkedInProfileUrl } from "@/content/linkedin-posts";
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
    title: "Engineering Activity Portfolio",
    description:
      "A static personal site with privacy-safe local activity collection, a live aggregate feed, and interactive yearly heatmaps.",
    reflection:
      "Privacy and data provenance should feel like product features, not footnotes.",
    discipline: "TypeScript · Data visualization",
    href: "https://github.com/JoshuaNguyen123/JoshuaNguyen123.github.io",
  },
  {
    number: "03",
    title: "Environmental Quality ML Dashboard",
    description:
      "An air-quality ML pipeline with reproducible training and a Streamlit dashboard.",
    reflection:
      "Model comparisons matter most when the results become understandable and usable.",
    discipline: "Python · Machine learning",
    href: "https://github.com/JoshuaNguyen123/environmental-quality-ml-dashboard",
  },
  {
    number: "04",
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
  ["Reliable agents", "Useful, observable, and easy to trust."],
  ["Private products", "Clear boundaries and careful data choices."],
  ["Developer experience", "Making complex systems easier to use."],
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
            <div><dt>Now</dt><dd>Building reliable AI agents</dd></div>
            <div><dt>Based in</dt><dd>Bozeman, Montana</dd></div>
            <div><dt>Interested in</dt><dd>AI, products, systems</dd></div>
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
          <p>I like solving problems—technically and operationally.</p>
          <p>
            I&apos;m most at home when a problem is still fuzzy: researching it,
            building a first version, and making the system easier to understand
            and trust.
          </p>
          <p>
            I&apos;m based in Bozeman, Montana, and I&apos;m especially interested in
            reliable agents, private products, and thoughtful developer tools.
          </p>
        </div>
      </section>

      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="eyebrow">04 projects</span>
          <h2>Selected work.</h2>
        </div>
        <div className="project-ledger">
          {projects.map((project) => (
            <a href={project.href} key={project.title} target="_blank" rel="noreferrer">
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
                <strong>View project</strong>
              </div>
            </a>
          ))}
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

        <LinkedInWidget posts={linkedInPosts} profileUrl={linkedInProfileUrl} />
      </section>

      <section className="activity-section" id="activity">
        <ActivityDashboard initialData={activity} />
      </section>

      <section className="contact-section" id="contact">
        <span className="eyebrow">Contact</span>
        <div>
          <h2>Let&apos;s talk.</h2>
          <p>
            If you&apos;re building something thoughtful—or wrestling with a tricky
            technical problem—I&apos;d be glad to hear about it.
          </p>
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
