import type { MetadataRoute } from "next";
import { siteUrl } from "@/content/site";
import { getPublishedPosts } from "@/lib/blog";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}/`,
    lastModified: new Date(`${post.publishedAt}T12:00:00Z`),
  }));
  return [
    { url: `${siteUrl}/`, lastModified: new Date() },
    { url: `${siteUrl}/activity/`, lastModified: new Date() },
    { url: `${siteUrl}/blog/`, lastModified: new Date() },
    ...posts,
  ];
}