import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/subpage.module.css";
import { ogImage, siteName } from "@/content/site";
import { getPublishedPost, getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import type { Metadata } from "next";
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
      <main className={styles.main} id="main">
        <article>
          <header className={styles.intro}>
            <a className={styles.back} href="/blog/">All writing</a>
            <h1>{post.title}</h1>
            <p className={styles.lede}>{post.summary}</p>
          </header>
          <div className={styles.section}>
            <dl className={styles.meta}>
              <dt>Published</dt>
              <dd><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></dd>
              <dt>Length</dt>
              <dd>{post.readingMinutes} min read</dd>
              <dt>Topics</dt>
              <dd>{post.tags.join(", ")}</dd>
              <dt>By</dt>
              <dd>{siteName}</dd>
            </dl>
            <div className="article-body" dangerouslySetInnerHTML={{ __html: post.html }} />
          </div>
          <footer className={styles.section}>
            <p className={styles.label}>Thanks for reading</p>
            <a className={styles.textLink} href="/blog/">All writing</a>
          </footer>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
