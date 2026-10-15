import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/subpage.module.css";
import { ogImage } from "@/content/site";
import { getPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import type { Metadata } from "next";

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
  // Newest first, one section per year: the year is the label column.
  const years = [...new Set(posts.map((post) => post.publishedAt.slice(0, 4)))];

  return (
    <>
      <SiteHeader current="writing" />
      <main className={styles.main} id="main">
        <header className={styles.intro}>
          <p className={styles.kicker}>Writing</p>
          <h1>Notes from the build.</h1>
          <p className={styles.lede}>A running record of what worked and why the &ldquo;quick fix&rdquo; now has its own folder.</p>
        </header>

        {years.length ? years.map((year) => (
          <section className={styles.section} key={year} aria-labelledby={`year-${year}`}>
            <h2 className={styles.label} id={`year-${year}`}>{year}</h2>
            <div className="writing-list">
              {posts.filter((post) => post.publishedAt.startsWith(year)).map((post) => (
                <a href={`/blog/${post.slug}/`} key={post.slug}>
                  <h3>{post.title}</h3>
                  <p>{post.summary}</p>
                  <span className="writing-meta">
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time> · {post.readingMinutes} min read · {post.tags.join(", ")}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )) : (
          <section className={styles.section}>
            <h2 className={styles.label}>Notes</h2>
            <p className={styles.prose}>The first note is on its way.</p>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
