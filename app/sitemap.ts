import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";

export const dynamic = "force-static";

const site = "https://joshuanguyen123.github.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts().map((post) => ({
    url: `${site}/blog/${post.slug}/`,
    lastModified: new Date(`${post.publishedAt}T12:00:00Z`),
  }));
  return [
    { url: `${site}/`, lastModified: new Date() },
    { url: `${site}/blog/`, lastModified: new Date() },
    ...posts,
  ];
}
