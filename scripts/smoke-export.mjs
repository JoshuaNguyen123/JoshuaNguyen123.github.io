import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
for (const file of ["out/index.html", "out/404.html", "out/activity/index.html", "out/admin/index.html", "out/blog/index.html", "out/blog/why-this-site-exists/index.html", "out/data/activity.json", "out/og-personal.jpg", "out/apple-touch-icon.png", "out/favicon.ico", "out/sitemap.xml"]) await access(path.join(root, file));
const html = await readFile(path.join(root, "out", "index.html"), "utf8");
for (const expected of ["Joshua Nguyen", "Forward-deployed engineer, AI developer, and technical researcher.", "building and testing systems across the stack", "I like working on ambiguous problems.", "Build Index", "Things I&#x27;ve built", "Obsidian Research Agent", "Ladybug", "Teach Anything", "Private repository", "Read my notes.", "not productivity", "Codex session-days", "Claude Code session-days", "Cursor session-days", "Cursor observed days", "GitHub minimums", "Observed activity", "Usage evidence"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
if (html.includes("Cursor applied AI line changes")) throw new Error("Static export still publishes the retired Cursor line-change claim");
const activityHtml = await readFile(path.join(root, "out", "activity", "index.html"), "utf8");
for (const expected of ["Session-day", "Zero vs. no coverage", "Why there is no line-change total", "numbers actually say"]) {
  if (!activityHtml.includes(expected)) throw new Error(`Activity definitions page is missing ${expected}`);
}
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

const projectPositions = ["Obsidian Research Agent", "Ladybug", "Teach Anything", "Personal AI Digest", "Book Service API"].map((project) => html.indexOf(project));
if (!projectPositions.every((position, index) => position >= 0 && (index === 0 || position > projectPositions[index - 1]))) throw new Error("Static export has the wrong selected-project order");
// Every project is on the page: three full entries, the rest as cards, each with a tile.
if ((html.match(/class="project-entry"/g) ?? []).length !== 3) throw new Error("Static export does not show three featured projects");
if ((html.match(/class="project-card"/g) ?? []).length !== 6) throw new Error("Static export does not show the six remaining projects");
if ((html.match(/class="project-tile(?: project-tile--image)?"/g) ?? []).length !== 9) throw new Error("Static export is missing project tiles");
if (html.indexOf('class="work-section"') > html.indexOf('class="activity-section"')) throw new Error("Static export shows activity before selected work");
for (const expected of ["What it taught me", "Bozeman, Montana", "Mobile navigation", "LinkedIn", 'rel="apple-touch-icon"', 'name="theme-color"', "application/ld+json", 'class="skip-link"']) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
// Every public page shares one header and footer; a page that loses them is a
// dead end for a visitor who arrived from search.
for (const page of ["out/index.html", "out/activity/index.html", "out/blog/index.html", "out/blog/why-this-site-exists/index.html", "out/404.html"]) {
  const pageHtml = await readFile(path.join(root, page), "utf8");
  for (const expected of ['aria-label="Primary navigation"', 'aria-label="Mobile navigation"', 'class="site-footer"', 'href="/blog/"', 'href="/#contact"']) {
    if (!pageHtml.includes(expected)) throw new Error(`${page} is missing shared chrome (${expected})`);
  }
}
const notFoundHtml = await readFile(path.join(root, "out", "404.html"), "utf8");
if (!notFoundHtml.includes("That page isn")) throw new Error("404 page is not the branded not-found route");
const blogHtml = await readFile(path.join(root, "out", "blog", "index.html"), "utf8");
for (const expected of ["Notes from the build.", "quick fix", "Why this site exists", "building in public", "August 21, 2026"]) {
  if (!blogHtml.includes(expected)) throw new Error(`Static blog export is missing ${expected}`);
}
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
