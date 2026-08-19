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
          <span className="wordmark-monogram">JN<span>/</span>26</span>
          <span className="wordmark-name">Joshua Nguyen</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#activity">Activity</a>
          <a href="#work">Work</a>
          <a href="#interests">Interests</a>
          <Link href="/blog/">Writing</Link>
          <a href="#contact">Contact</a>
        </nav>
        <span className="header-status"><i /> Available for thoughtful work</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-index" aria-hidden="true">01</div>
        <div className="hero-copy">
          <span className="eyebrow">Joshua Nguyen · Systems engineer</span>
          <h1>I&apos;m Joshua, a systems engineer building reliable AI and product infrastructure.</h1>
          <p>
            My work lives at the intersection of agentic systems, product
            engineering, and developer infrastructure. I care about clarity,
            operability, and privacy by design.
          </p>
          <span className="hero-location">Denver, Colorado · Mountain Time</span>
          <div className="hero-actions">
            <a className="primary-link" href="#activity">View activity <span>↘</span></a>
            <Link className="primary-link" href="/blog/">Read writing <span>↗</span></Link>
          </div>
        </div>
        <aside className="hero-now" aria-label="What Joshua is focused on right now">
          <span>Right now</span>
          <ul>
            <li>Building agentic tools that handle real work</li>
            <li>Ship reliable product infrastructure</li>
            <li>Strengthen developer foundations</li>
          </ul>
        </aside>
      </section>

      <section className="activity-section" id="activity">
        <ActivityDashboard initialData={activity} />
      </section>

      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="eyebrow">Selected work / 03</span>
          <h2>A few kinds of problems<br />I keep coming back to.</h2>
        </div>
        <div className="work-list">
          <article>
            <span>01</span>
            <div><h3>Making agents easier to trust</h3><p>Resumable workflows, bounded tool access, source receipts, and completion you can actually inspect.</p></div>
            <strong>AI / Knowledge</strong>
          </article>
          <article>
            <span>02</span>
            <div><h3>Building private products for real relationships</h3><p>Native-first experiences with explicit privacy contracts and service boundaries that hold up.</p></div>
            <strong>Product / Systems</strong>
          </article>
          <article>
            <span>03</span>
            <div><h3>Automating the repetitive parts</h3><p>Operational data pipelines, intelligence digests, and dashboards that turn repeated work into a useful habit.</p></div>
            <strong>Data / Automation</strong>
          </article>
        </div>
      </section>

      <section className="interests-section" id="interests">
        <div className="section-heading">
          <span className="eyebrow">Interests & writing / 04</span>
          <h2>What I&apos;m learning<br />and writing about.</h2>
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
        <span className="eyebrow">Say hello / 05</span>
        <h2>Want to compare notes?</h2>
        <p>If you&apos;re thinking about reliable AI systems, applied automation, or thoughtful product engineering, I&apos;d enjoy hearing what you&apos;re working on.</p>
        <a href="https://github.com/JoshuaNguyen123">Find me on GitHub <span>↗</span></a>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Josh N.</span>
        <span>A small window into what I&apos;m building.</span>
      </footer>
    </main>
  );
}
