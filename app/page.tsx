import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { LinkedInWidget } from "@/components/social/LinkedInWidget";
import { linkedInPosts, linkedInProfileUrl } from "@/content/linkedin-posts";
import { getPublishedPosts } from "@/lib/blog";
import type { ActivitySnapshot } from "@/lib/activity/types";
import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

function loadActivitySnapshot(): ActivitySnapshot {
  const snapshotPath = path.join(process.cwd(), "public", "data", "activity.json");
  return JSON.parse(readFileSync(snapshotPath, "utf8")) as ActivitySnapshot;
}

const interests = [
  ["Agentic systems", "Bounded autonomy, observable execution, and tools that can prove completion."],
  ["Privacy-first products", "Useful software with explicit authority, data minimization, and safe defaults."],
  ["Developer tooling", "Interfaces and infrastructure that make complex engineering work feel legible."],
  ["Applied automation", "Operational systems that turn repeated work into dependable, reviewable flows."],
  ["iOS engineering", "Native product experiences shaped around clarity, responsiveness, and trust."],
  ["Technical research", "Source-backed exploration that ends in decisions, artifacts, and working systems."],
] as const;

export default function Home() {
  const activity = loadActivitySnapshot();
  const posts = getPublishedPosts();

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Joshua Nguyen home">
          JN<span>/</span>26
        </a>
        <nav aria-label="Primary navigation">
          <a href="#activity">Activity</a>
          <a href="#work">Work</a>
          <a href="#interests">Interests</a>
          <a href="#contact">Contact</a>
        </nav>
        <span className="header-status"><i /> Available for thoughtful work</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-index" aria-hidden="true">01</div>
        <div className="hero-copy">
          <span className="eyebrow">Joshua Nguyen · Systems engineer</span>
          <h1>Software that thinks.<br />Systems that prove it.</h1>
          <p>
            I build reliable agentic tools, privacy-first products, and the
            infrastructure that makes ambitious software accountable.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#activity">Explore build activity <span>↘</span></a>
            <span>Denver · Mountain Time</span>
          </div>
        </div>
        <div className="hero-signal" aria-label="Current focus areas">
          <span>Current signal</span>
          <strong>Agentic systems</strong>
          <strong>Product engineering</strong>
          <strong>Developer infrastructure</strong>
        </div>
      </section>

      <section className="activity-section" id="activity">
        <ActivityDashboard initialData={activity} />
      </section>

      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="eyebrow">Selected systems / 03</span>
          <h2>Work built around<br />clear proof boundaries.</h2>
        </div>
        <div className="work-list">
          <article>
            <span>01</span>
            <div><h3>Agentic research systems</h3><p>Resumable workflows, bounded tool access, source receipts, and observable completion.</p></div>
            <strong>AI / Knowledge</strong>
          </article>
          <article>
            <span>02</span>
            <div><h3>Private product infrastructure</h3><p>Native-first experiences with explicit privacy contracts and testable service boundaries.</p></div>
            <strong>Product / Systems</strong>
          </article>
          <article>
            <span>03</span>
            <div><h3>Applied automation</h3><p>Operational data pipelines, intelligence digests, and dashboards designed for action.</p></div>
            <strong>Data / Automation</strong>
          </article>
        </div>
      </section>

      <section className="interests-section" id="interests">
        <div className="section-heading">
          <span className="eyebrow">Interests & writing / 04</span>
          <h2>Questions worth<br />staying with.</h2>
        </div>
        <div className="interest-grid">
          {interests.map(([title, description], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        {posts.length > 0 ? (
          <div className="writing-list">
            <div className="writing-heading"><span className="eyebrow">Published notes</span><Link href="/blog/">View all</Link></div>
            {posts.slice(0, 3).map((post) => (
              <Link href={`/blog/${post.slug}/`} key={post.slug}>
                <time dateTime={post.publishedAt}>{post.publishedAt}</time>
                <div><h3>{post.title}</h3><p>{post.summary}</p></div>
                <span>↗</span>
              </Link>
            ))}
          </div>
        ) : null}

        <LinkedInWidget posts={linkedInPosts} profileUrl={linkedInProfileUrl} />
      </section>

      <section className="contact-section" id="contact">
        <span className="eyebrow">Start a conversation / 05</span>
        <h2>Complex problem.<br />Clear next move.</h2>
        <p>Interested in reliable AI systems, applied automation, or ambitious product engineering? Let&apos;s compare notes.</p>
        <a href="https://github.com/JoshuaNguyen123">Find Joshua on GitHub <span>↗</span></a>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Josh N.</span>
        <span>Designed as an observable system.</span>
      </footer>
    </main>
  );
}
