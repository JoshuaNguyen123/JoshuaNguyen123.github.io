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
  return post ? { title: `${post.title} - Joshua Nguyen`, description: post.summary } : {};
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) notFound();

  return (
    <main className="blog-shell blog-article">
      <Link className="blog-back" href="/blog/">&larr; All writing</Link>
      <header>
        <span className="eyebrow">{post.tags.join(" / ")}</span>
        <h1>{post.title}</h1>
        <time dateTime={post.publishedAt}>{post.publishedAt}</time>
      </header>
      <article dangerouslySetInnerHTML={{ __html: post.html }} />
    </main>
  );
}
