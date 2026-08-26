import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
for (const file of ["out/index.html", "out/activity/index.html", "out/admin/index.html", "out/blog/index.html", "out/blog/why-this-site-exists/index.html", "out/data/activity.json", "out/og-personal.jpg"]) await access(path.join(root, file));
const html = await readFile(path.join(root, "out", "index.html"), "utf8");
for (const expected of ["Joshua Nguyen", "FDE, AI Developer, and Technical Researcher.", "building and testing systems across the stack", "I like working on ambiguous problems.", "Build Index", "Things I&#x27;ve built", "Obsidian Research Agent", "Ladybug", "Teach Anything", "Private repository", "Read my notes.", "not productivity", "Codex session-days", "Claude Code session-days", "Cursor session-days", "Cursor observed days", "Observed activity", "Usage evidence"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
if (html.includes("Cursor applied AI line changes")) throw new Error("Static export still publishes the retired Cursor line-change claim");
const activityHtml = await readFile(path.join(root, "out", "activity", "index.html"), "utf8");
for (const expected of ["Session-day", "Zero vs. no coverage", "Why there is no line-change total", "numbers actually say"]) {
  if (!activityHtml.includes(expected)) throw new Error(`Activity definitions page is missing ${expected}`);
}
const projectPositions = ["Obsidian Research Agent", "Ladybug", "Teach Anything"].map((project) => html.indexOf(project));
if (!projectPositions.every((position, index) => position >= 0 && (index === 0 || position > projectPositions[index - 1]))) throw new Error("Static export has the wrong selected-project order");
if (html.indexOf('class="work-section"') > html.indexOf('class="activity-section"')) throw new Error("Static export shows activity before selected work");
for (const expected of ["What it taught me", "Bozeman, Montana", "Mobile navigation", "LinkedIn"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
const blogHtml = await readFile(path.join(root, "out", "blog", "index.html"), "utf8");
for (const expected of ["Notes from the build.", "quick fix", "Why this site exists", "building in public", "August 21, 2026"]) {
  if (!blogHtml.includes(expected)) throw new Error(`Static blog export is missing ${expected}`);
}
const articleHtml = await readFile(path.join(root, "out", "blog", "why-this-site-exists", "index.html"), "utf8");
for (const expected of ["Keep some of the sawdust", "Nobody needs a leaderboard for opening Cursor", "Why write any of this"]) {
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
