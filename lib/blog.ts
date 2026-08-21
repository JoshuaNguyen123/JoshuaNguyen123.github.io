import matter from "gray-matter";
import { marked } from "marked";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface BlogPostSummary {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  tags: string[];
  draft: boolean;
  readingMinutes: number;
}

export interface BlogPost extends BlogPostSummary {
  html: string;
}

const contentDirectory = path.join(process.cwd(), "content", "blog");
const frontmatterKeys = new Set(["slug", "title", "summary", "publishedAt", "tags", "draft"]);

function readPost(filename: string, directory = contentDirectory): BlogPost {
  const source = readFileSync(path.join(directory, filename), "utf8");
  const { data, content } = matter(source);
  const publishedAt = data.publishedAt instanceof Date ? data.publishedAt.toISOString().slice(0, 10) : data.publishedAt;
  const unknownKeys = Object.keys(data).filter((key) => !frontmatterKeys.has(key));
  if (unknownKeys.length) throw new Error(`Unknown blog frontmatter: ${unknownKeys.join(", ")}`);
  if (
    typeof data.slug !== "string" ||
    typeof data.title !== "string" ||
    typeof data.summary !== "string" ||
    typeof publishedAt !== "string" ||
    !Array.isArray(data.tags) ||
    !data.tags.every((tag: unknown) => typeof tag === "string") ||
    typeof data.draft !== "boolean" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ||
    Number.isNaN(Date.parse(`${publishedAt}T12:00:00Z`)) ||
    data.title.trim() === "" ||
    data.summary.trim() === "" ||
    data.tags.some((tag: string) => tag.trim() === "")
  ) {
    throw new Error(`Invalid blog frontmatter in ${filename}`);
  }
  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/u).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
  return { ...data, publishedAt, readingMinutes, html: marked.parse(content) as string } as BlogPost;
}

export function getAllPosts(directory = contentDirectory): BlogPost[] {
  if (!existsSync(directory)) return [];
  const posts = readdirSync(directory)
    .filter((filename) => filename.endsWith(".md") && !filename.startsWith("_"))
    .map((filename) => readPost(filename, directory))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (new Set(posts.map((post) => post.slug)).size !== posts.length) throw new Error("Blog slugs must be unique");
  return posts;
}

export function getPublishedPosts(directory = contentDirectory): BlogPost[] {
  return getAllPosts(directory).filter((post) => !post.draft);
}

export function getPublishedPost(slug: string, directory = contentDirectory): BlogPost | undefined {
  return getPublishedPosts(directory).find((post) => post.slug === slug);
}
