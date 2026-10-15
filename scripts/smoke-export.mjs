import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { getPublishedPosts } from "../lib/blog.ts";

const root = process.cwd();
const projectSource = await readFile(path.join(root, "content", "projects.ts"), "utf8");
const projectSlugs = [...projectSource.matchAll(/slug: "([a-z0-9-]+)"/g)].map((match) => match[1]);
if (projectSlugs.length !== 9) throw new Error("Expected nine project case studies");
for (const file of ["out/index.html", "out/404.html", "out/activity/index.html", "out/admin/index.html", "out/blog/index.html", "out/blog/why-this-site-exists/index.html", "out/work/obsidian-research-agent/index.html", "out/work/ladybug/index.html", "out/data/activity.json", "out/og-personal.jpg", "out/apple-touch-icon.png", "out/favicon.ico", "out/projects/obsidian-research-agent-architecture.svg", "out/sitemap.xml"]) await access(path.join(root, file));
const html = await readFile(path.join(root, "out", "index.html"), "utf8");
const homeHeadline = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
for (const expected of ["Joshua Nguyen", "Selected work", "Obsidian Research Agent", "Ladybug", "Teach Anything", "Private repository"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
if (homeHeadline !== "I build research agents and retrieval systems that show their work.") throw new Error("Static export is missing the selected homepage headline");
if (html.includes("Cursor applied AI line changes")) throw new Error("Static export still publishes the retired Cursor line-change claim");
const activityHtml = await readFile(path.join(root, "out", "activity", "index.html"), "utf8");
for (const expected of ["Build Index", "not productivity", "Codex session-days", "Claude Code session-days", "Cursor session-days", "Cursor observed days", "Observed activity", "Usage evidence", "Session-day", "Zero vs. no coverage", "Why there is no line-change total", "numbers actually say"]) {
  if (!activityHtml.includes(expected)) throw new Error(`Activity page is missing ${expected}`);
}
if (activityHtml.includes("Cursor applied AI line changes")) throw new Error("Activity page still publishes the retired Cursor line-change claim");
// A contact backend is configured, so the form must actually be in the export.
// Switching backends once silently dropped it from the live site: the component
// renders nothing when it has nowhere to post, and that read as a normal build.
const contactConfigured = Boolean(process.env.NEXT_PUBLIC_CONTACT_API_URL && process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY)
  || Boolean(process.env.NEXT_PUBLIC_WEB3FORMS_KEY);
if (contactConfigured) {
  for (const expected of ["contact-form", "h-captcha", "Send message"]) {
    if (!html.includes(expected)) throw new Error(`Static export is missing the contact form (${expected})`);
  }
}

// Every project remains reachable through a real link, independent of visual
// card classes. Architecture diagrams remain in their case studies.
const homeLinks = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1]);
const projectLinks = new Set(homeLinks.filter((href) => /^\/work\/[a-z0-9-]+\/$/.test(href)));
if (projectLinks.size !== projectSlugs.length) throw new Error("Static export is missing project destinations");
for (const slug of projectSlugs) {
  if (!projectLinks.has(`/work/${slug}/`)) throw new Error(`Missing case-study link: ${slug}`);
  const detail = await readFile(path.join(root, "out", "work", slug, "index.html"), "utf8");
  if (!detail.includes(`/projects/${slug}-architecture.svg`) || !detail.includes("Architecture diagram of")) throw new Error(`Missing case-study diagram: ${slug}`);
}
for (const photo of ["hiking-valley.jpg"]) {
  await access(path.join(root, "out", "images", photo));
  if (!html.includes(`/images/${photo}`)) throw new Error(`Static export is missing ${photo}`);
}
// Selected work ships its scroll-linked index as plain in-page links, so it
// still works as a table of contents before (or without) JavaScript.
const workIndex = html.match(/<nav\b[^>]*aria-label="Selected projects"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
for (const slug of projectSlugs.slice(0, 3)) {
  if (!workIndex.includes(`href="#project-${slug}"`) || !html.includes(`id="project-${slug}"`)) throw new Error(`Selected work index is missing ${slug}`);
}
if (!/<section\b[^>]*\bid="more"/.test(html)) throw new Error("Missing the more-projects index");
if (!activityHtml.includes('class="monthly-disclosure"')) throw new Error("Missing progressive disclosure for monthly charts");
const sectionPositions = Object.fromEntries(["work", "activity", "writing", "contact"].map((id) => [id, html.indexOf(`id="${id}"`)]));
for (const [id, position] of Object.entries(sectionPositions)) {
  if (position < 0) throw new Error(`Static export is missing the ${id} section`);
}
if (sectionPositions.work > sectionPositions.activity || sectionPositions.work > sectionPositions.writing) throw new Error("Static export shows supporting sections before selected work");
if (sectionPositions.contact < sectionPositions.activity || sectionPositions.contact < sectionPositions.writing) throw new Error("Static export shows contact before the supporting sections");
const homeActivitySection = html.match(/<section\b[^>]*\bid="activity"[^>]*>([\s\S]*?)<\/section>/)?.[1];
if (!homeActivitySection || !/<a\b[^>]*\bhref="\/activity\/"/.test(homeActivitySection)) throw new Error("Homepage activity summary is missing its dashboard link");
const latestPost = getPublishedPosts()[0];
const homeWritingSection = html.match(/<section\b[^>]*\bid="writing"[^>]*>([\s\S]*?)<\/section>/)?.[1];
const writingLinks = [...(homeWritingSection ?? "").matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1]);
if (!homeWritingSection || !writingLinks.includes(latestPost ? `/blog/${latestPost.slug}/` : "/blog/")) throw new Error("Homepage writing is missing its latest published article or blog link");
for (const expected of ["Bozeman, Montana", "LinkedIn", 'rel="apple-touch-icon"', 'name="theme-color"', "application/ld+json", 'class="skip-link"']) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
// Every public page shares one header and footer; a page that loses them is a
// dead end for a visitor who arrived from search.
for (const page of ["out/index.html", "out/activity/index.html", "out/blog/index.html", "out/blog/why-this-site-exists/index.html", "out/work/obsidian-research-agent/index.html", "out/404.html"]) {
  const pageHtml = await readFile(path.join(root, page), "utf8");
  for (const expected of ['aria-label="Primary navigation"', 'class="site-footer"', 'href="/blog/"', 'href="/#contact"']) {
    if (!pageHtml.includes(expected)) throw new Error(`${page} is missing shared chrome (${expected})`);
  }
}
const notFoundHtml = await readFile(path.join(root, "out", "404.html"), "utf8");
if (!notFoundHtml.includes("That page isn")) throw new Error("404 page is not the branded not-found route");
const blogHtml = await readFile(path.join(root, "out", "blog", "index.html"), "utf8");
for (const expected of ["Notes from the build.", "quick fix", "Why this site exists", "building in public", "August 21, 2026"]) {
  if (!blogHtml.includes(expected)) throw new Error(`Static blog export is missing ${expected}`);
}
const sitemapXml = await readFile(path.join(root, "out", "sitemap.xml"), "utf8");
if (!sitemapXml.includes("/work/obsidian-research-agent/") || !sitemapXml.includes("/work/ladybug/")) throw new Error("Sitemap is missing work case-study routes");
const workHtml = await readFile(path.join(root, "out", "work", "obsidian-research-agent", "index.html"), "utf8");
for (const expected of ["What it does", "How the pieces connect", "What was hard", "Architecture diagram of Obsidian Research Agent", "View repository"]) {
  if (!workHtml.includes(expected)) throw new Error(`Work case study is missing ${expected}`);
}
const privateWorkHtml = await readFile(path.join(root, "out", "work", "ladybug", "index.html"), "utf8");
if (!privateWorkHtml.includes("Private repository") || privateWorkHtml.includes("View repository")) throw new Error("Private case study has the wrong repository CTA");
const articleHtml = await readFile(path.join(root, "out", "blog", "why-this-site-exists", "index.html"), "utf8");
for (const expected of ["Keep some of the sawdust", "Nobody needs a leaderboard for opening Cursor", "Why write any of this", 'property="og:type" content="article"', 'property="article:published_time"']) {
  if (!articleHtml.includes(expected)) throw new Error(`Static article export is missing ${expected}`);
}
const adminHtml = await readFile(path.join(root, "out", "admin", "index.html"), "utf8");
for (const expected of ["Private blog editor", "Checking your editor session", "noindex"]) {
  if (!adminHtml.includes(expected)) throw new Error(`Static admin export is missing ${expected}`);
}
for (const forbidden of ["Josh B.", "/api/activity", "WakaTime", "active minutes", "token totals", "Cursor Team Admin API", "Anthropic organization analytics"]) {
  if (html.includes(forbidden)) throw new Error(`Static export contains forbidden text: ${forbidden}`);
}
console.log("Static export smoke test passed");
