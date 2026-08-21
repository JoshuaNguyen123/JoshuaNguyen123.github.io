import { getPublishedPost, getPublishedPosts } from "@/lib/blog";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  const posts = getPublishedPosts();
  return posts.length ? posts.map((post) => ({ slug: post.slug })) : [{ slug: "__empty" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  return post ? { title: `${post.title} — Joshua Nguyen`, description: post.summary } : {};
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) notFound();

  return (
    <main className="blog-shell blog-article">
      <header className="blog-masthead">
        <Link href="/">Joshua Nguyen</Link>
        <Link href="/blog/">Writing</Link>
        <span>Denver · 2026</span>
      </header>

      <article>
        <header className="article-header">
          <Link className="blog-back" href="/blog/">← All writing</Link>
          <span className="eyebrow">{post.tags.join(" · ")}</span>
          <h1>{post.title}</h1>
          <p>{post.summary}</p>
          <div className="article-byline">
            <span>By Joshua Nguyen</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            <span>{post.readingMinutes} min read</span>
          </div>
        </header>
        <div className="article-body" dangerouslySetInnerHTML={{ __html: post.html }} />
        <footer className="article-footer">
          <span className="eyebrow">Thanks for reading</span>
          <Link href="/blog/">All writing <span aria-hidden="true">↗</span></Link>
        </footer>
      </article>

      <footer className="blog-footer">
        <span>Joshua Nguyen · FDE · AI developer · Technical researcher</span>
        <Link href="https://github.com/JoshuaNguyen123">GitHub <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
