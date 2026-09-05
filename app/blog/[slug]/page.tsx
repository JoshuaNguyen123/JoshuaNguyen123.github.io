import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ogImage, siteName } from "@/content/site";
import { getPublishedPost, getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
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
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}/` },
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      url: `/blog/${post.slug}/`,
      publishedTime: `${post.publishedAt}T12:00:00Z`,
      authors: [siteName],
      tags: post.tags,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) notFound();

  return (
    <>
      <SiteHeader current="writing" />
      <main className="blog-shell blog-article" id="main">
        <article>
          <header className="article-header">
            <Link className="blog-back" href="/blog/">All writing</Link>
            <span className="eyebrow">{post.tags.join(" · ")}</span>
            <h1>{post.title}</h1>
            <p>{post.summary}</p>
            <div className="article-byline">
              <span>By {siteName}</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span>{post.readingMinutes} min read</span>
            </div>
          </header>
          <div className="article-body" dangerouslySetInnerHTML={{ __html: post.html }} />
          <footer className="article-footer">
            <span className="eyebrow">Thanks for reading</span>
            <Link href="/blog/">All writing</Link>
          </footer>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}