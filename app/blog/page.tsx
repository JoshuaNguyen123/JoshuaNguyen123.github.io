import { getPublishedPosts } from "@/lib/blog";
import { linkedInProfileUrl } from "@/content/linkedin-posts";
import Link from "next/link";

export const metadata = {
  title: "Writing — Joshua Nguyen",
  description: "Joshua Nguyen writes about AI systems, research, and software.",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function BlogIndex() {
  const posts = getPublishedPosts();
  const [leadPost, ...morePosts] = posts;

  return (
    <main className="blog-shell">
      <header className="blog-masthead">
        <Link href="/" aria-label="Back to Joshua Nguyen's home page">Joshua Nguyen</Link>
        <span>Writing</span>
        <span>Bozeman · 2026</span>
      </header>

      <section className="blog-intro">
        <span className="eyebrow">Writing</span>
        <h1>Notes on building.</h1>
        <p>AI systems, research, and lessons from the work.</p>
      </section>

      {leadPost ? (
        <section className="blog-issue" aria-label="Published writing">
          <Link className="lead-story" href={`/blog/${leadPost.slug}/`}>
            <div className="story-label"><span>Latest</span><span>{leadPost.tags.join(" · ")}</span></div>
            <h2>{leadPost.title}</h2>
            <p>{leadPost.summary}</p>
            <div className="story-byline">
              <time dateTime={leadPost.publishedAt}>{formatDate(leadPost.publishedAt)}</time>
              <span>{leadPost.readingMinutes} min read</span>
            </div>
          </Link>
          {morePosts.length > 0 ? (
            <div className="blog-index-list">
              {morePosts.map((post) => (
                <Link href={`/blog/${post.slug}/`} key={post.slug}>
                  <div className="story-label"><span>{post.tags.join(" · ")}</span><span>{post.readingMinutes} min</span></div>
                  <h2>{post.title}</h2>
                  <p>{post.summary}</p>
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="blog-empty" aria-labelledby="empty-title">
          <div>
            <span className="eyebrow">Coming soon</span>
            <h2 id="empty-title">First piece in progress.</h2>
          </div>
          <div className="blog-empty-note">
            <p>I&apos;m working on the first note.</p>
            <Link href="/">See my work</Link>
          </div>
          <ul aria-label="Subjects planned for future writing">
            <li><span>01</span>Reliable agents</li>
            <li><span>02</span>Privacy by design</li>
            <li><span>03</span>Building in public</li>
          </ul>
        </section>
      )}

      <footer className="blog-footer">
        <span>Joshua Nguyen · FDE · AI developer · Technical researcher</span>
        <div className="blog-footer-links">
          {linkedInProfileUrl ? <Link href={linkedInProfileUrl}>LinkedIn</Link> : null}
          <Link href="https://github.com/JoshuaNguyen123">GitHub</Link>
        </div>
      </footer>
    </main>
  );
}
