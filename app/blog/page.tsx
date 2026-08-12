import { getPublishedPosts } from "@/lib/blog";
import Link from "next/link";

export const metadata = { title: "Writing - Joshua Nguyen" };

export default function BlogIndex() {
  const posts = getPublishedPosts();
  return (
    <main className="blog-shell">
      <Link className="blog-back" href="/">&larr; Joshua Nguyen</Link>
      <header><span className="eyebrow">Writing</span><h1>Published notes.</h1></header>
      {posts.length > 0 ? (
        <div className="blog-index-list">
          {posts.map((post) => (
            <Link href={`/blog/${post.slug}/`} key={post.slug}>
              <time dateTime={post.publishedAt}>{post.publishedAt}</time>
              <div><h2>{post.title}</h2><p>{post.summary}</p></div>
            </Link>
          ))}
        </div>
      ) : <p className="blog-empty">No public notes yet.</p>}
    </main>
  );
}
