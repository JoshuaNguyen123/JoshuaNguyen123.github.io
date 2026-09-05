import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ogImage } from "@/content/site";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";

const title = "Writing";
const description = "Joshua Nguyen writes about AI systems, research, and software.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/blog/" },
  openGraph: { title, description, type: "website", url: "/blog/", images: [ogImage] },
};

export default function BlogIndex() {
  const posts = getPublishedPosts();
  const [leadPost, ...morePosts] = posts;

  return (
    <>
      <SiteHeader current="writing" />
      <main className="blog-shell" id="main">
        <section className="blog-intro">
          <span className="eyebrow">Writing</span>
          <h1>Notes from the build.</h1>
          <p>A running record of what worked and why the &ldquo;quick fix&rdquo; now has its own folder.</p>
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
                    <div className="story-label"><span>{post.tags.join(" · ")}</span><span>{post.readingMinutes} min read</span></div>
                    <h2>{post.title}</h2>
                    <p>{post.summary}</p>
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="blog-issue" aria-label="Published writing">
            <p className="blog-empty-line">The first note is on its way.</p>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}