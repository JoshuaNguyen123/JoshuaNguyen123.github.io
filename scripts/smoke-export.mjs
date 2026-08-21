import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
for (const file of ["out/index.html", "out/blog/index.html", "out/blog/why-this-site-exists/index.html", "out/data/activity.json", "out/og-personal.jpg"]) await access(path.join(root, file));
const html = await readFile(path.join(root, "out", "index.html"), "utf8");
for (const expected of ["Joshua Nguyen", "FDE, AI developer, and technical researcher.", "I like working on ambiguous problems.", "Build Index", "Things I&#x27;ve built", "Personal AI Digest", "Private repository", "Obsidian Research Agent", "Engineering Activity Portfolio", "Environmental Quality ML Dashboard", "Book Service API", "not productivity", "Codex active session-days", "Claude active session-days", "Cursor active session-days", "Cursor applied AI line changes", "Observed activity", "Usage evidence"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
const projectPositions = ["Obsidian Research Agent", "Engineering Activity Portfolio", "Environmental Quality ML Dashboard", "Book Service API"].map((project) => html.indexOf(project));
if (!projectPositions.every((position, index) => position >= 0 && (index === 0 || position > projectPositions[index - 1]))) throw new Error("Static export has the wrong selected-project order");
if (html.indexOf('class="work-section"') > html.indexOf('class="activity-section"')) throw new Error("Static export shows activity before selected work");
for (const expected of ["What it taught me", "Bozeman, Montana", "Mobile navigation", "LinkedIn"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
const blogHtml = await readFile(path.join(root, "out", "blog", "index.html"), "utf8");
for (const expected of ["Why this site exists", "building in public", "August 21, 2026"]) {
  if (!blogHtml.includes(expected)) throw new Error(`Static blog export is missing ${expected}`);
}
const articleHtml = await readFile(path.join(root, "out", "blog", "why-this-site-exists", "index.html"), "utf8");
for (const expected of ["A portfolio should show the process", "The private parts stay private", "Why I am writing here"]) {
  if (!articleHtml.includes(expected)) throw new Error(`Static article export is missing ${expected}`);
}
for (const forbidden of ["Josh B.", "/api/activity", "WakaTime", "active minutes", "token totals", "Cursor Team Admin API", "Anthropic organization analytics"]) {
  if (html.includes(forbidden)) throw new Error(`Static export contains forbidden text: ${forbidden}`);
}
console.log("Static export smoke test passed");
