import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { LinkedInWidget } from "@/components/social/LinkedInWidget";
import { linkedInPosts, linkedInProfileUrl } from "@/content/linkedin-posts";
import { getPublishedPosts } from "@/lib/blog";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import type { ActivitySnapshot } from "@/lib/activity/types";
import { readFileSync } from "node:fs";
import path from "node:path";
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
    discipline: "TypeScript · Agent systems",
    href: "https://github.com/JoshuaNguyen123/Obsidian_research_agent",
  },
  {
    number: "02",
    title: "Environmental Quality ML Dashboard",
    description:
      "An air-quality ML pipeline with reproducible training and a Streamlit dashboard.",
    discipline: "Python · Machine learning",
    href: "https://github.com/JoshuaNguyen123/environmental-quality-ml-dashboard",
  },
  {
    number: "03",
    title: "Book Service API",
    description:
      "A FastAPI service with search, ISBN lookup, web import, and local AI enrichment.",
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
          <span className="wordmark-name">Joshua Nguyen</span>
          <span className="wordmark-role">FDE · AI developer · Technical researcher</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <Link href="/blog/">Writing</Link>
          <a href="#activity">Activity</a>
          <a href="#contact">Contact</a>
        </nav>
        <span className="header-edition">Denver · 2026</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker" aria-hidden="true">Work · Research · Notes</div>
        <div className="hero-copy">
          <span className="eyebrow">Joshua Nguyen</span>
          <h1>FDE, AI developer, and technical researcher.</h1>
          <p>I build practical AI systems and help teams solve technical problems.</p>
          <div className="hero-actions">
            <a className="primary-link" href="#work">See what I&apos;m building <span aria-hidden="true">↘</span></a>
            <Link className="text-link" href="/blog/">Read my notes <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <aside className="hero-now" aria-label="What Joshua is focused on right now">
          <span className="eyebrow">Now</span>
          <p>Building reliable AI agents.</p>
          <dl>
            <div><dt>Based in</dt><dd>Denver, Colorado</dd></div>
            <div><dt>Interested in</dt><dd>AI, products, systems</dd></div>
            <div><dt>Usually doing</dt><dd>Building and learning</dd></div>
          </dl>
        </aside>
      </section>

      <section className="about-strip" id="about">
        <span className="eyebrow">About</span>
        <p>I like solving problems—technically and operationally.</p>
      </section>

      <section className="activity-section" id="activity">
        <div className="activity-intro">
          <span className="eyebrow">Activity</span>
          <p>A privacy-safe view of my recent engineering work.</p>
        </div>
        <ActivityDashboard initialData={activity} />
      </section>

      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="eyebrow">03 projects</span>
          <h2>Selected work.</h2>
        </div>
        <div className="project-ledger">
          {projects.map((project) => (
            <a href={project.href} key={project.title} target="_blank" rel="noreferrer">
              <span className="project-number">{project.number}</span>
              <div className="project-story">
                <h3>{project.title}</h3>
                <p>{project.description}</p>
              </div>
              <div className="project-meta">
                <span>{project.discipline}</span>
                <strong>View project <span aria-hidden="true">↗</span></strong>
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
            <Link href="/blog/">Visit the notebook <span aria-hidden="true">↗</span></Link>
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

      <section className="contact-section" id="contact">
        <span className="eyebrow">Contact</span>
        <div>
          <h2>Let&apos;s talk.</h2>
          <p>AI, research, developer tools, or an interesting problem.</p>
          <a href="https://github.com/JoshuaNguyen123">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Joshua Nguyen</span>
        <span>Made in Denver · Still a work in progress</span>
      </footer>
    </main>
  );
}
