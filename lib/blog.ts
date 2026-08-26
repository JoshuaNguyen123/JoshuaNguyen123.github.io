import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
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

// marked emits raw HTML from Markdown verbatim, and the result is rendered with
// dangerouslySetInnerHTML, so a post could otherwise ship script into every page.
// Allow only what the editorial styles in globals.css actually target.
const allowedTags = [
  "p", "br", "hr", "blockquote", "pre", "code",
  "h2", "h3", "h4", "ul", "ol", "li",
  "strong", "em", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td",
];

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags,
  allowedAttributes: {
    // target/rel are permitted only so transformTags can add canonical values;
    // author-provided values are removed before the sanitized output is emitted.
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    code: ["class"],
    th: ["scope"],
  },
  // http(s) and mailto only: blocks javascript:, data:, and vbscript: URIs.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    // Outbound links from posts should not leak referrer or window.opener.
    a: (tagName, attribs) => {
      const safeAttributes = Object.fromEntries(Object.entries(attribs).filter(([name]) => name !== "target" && name !== "rel"));
      let outbound = false;
      try {
        const destination = new URL(attribs.href ?? "", "https://joshuanguyen123.github.io");
        outbound = ["http:", "https:"].includes(destination.protocol) && destination.origin !== "https://joshuanguyen123.github.io";
      } catch { /* The sanitizer removes invalid URLs. */ }
      return { tagName, attribs: outbound ? { ...safeAttributes, target: "_blank", rel: "noreferrer noopener" } : safeAttributes };
    },
  },
};

/** Renders post Markdown to HTML with raw HTML stripped to a known-safe subset. */
export function renderPostHtml(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown) as string, sanitizeOptions);
}

const contentDirectory = path.join(process.cwd(), "content", "blog");
const frontmatterKeys = new Set(["slug", "title", "summary", "publishedAt", "tags", "draft"]);

export function parseBlogFrontmatter(source: string) {
  return matter(source);
}

function readPost(filename: string, directory = contentDirectory): BlogPost {
  const source = readFileSync(path.join(directory, filename), "utf8");
  const { data, content } = parseBlogFrontmatter(source);
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
  return { ...data, publishedAt, readingMinutes, html: renderPostHtml(content) } as BlogPost;
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
