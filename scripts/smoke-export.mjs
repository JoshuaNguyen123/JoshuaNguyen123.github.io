import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
for (const file of ["out/index.html", "out/data/activity.json", "out/og.png"]) await access(path.join(root, file));
const html = await readFile(path.join(root, "out", "index.html"), "utf8");
for (const expected of ["Joshua Nguyen", "Build Index", "Interests &amp; writing", "not productivity", "Codex active session-days", "Claude active session-days", "Cursor active session-days", "Cursor applied AI line changes", "Observed activity", "Usage evidence"]) {
  if (!html.includes(expected)) throw new Error(`Static export is missing ${expected}`);
}
for (const forbidden of ["Josh B.", "/api/activity", "WakaTime", "active minutes", "token totals", "Cursor Team Admin API", "Anthropic organization analytics"]) {
  if (html.includes(forbidden)) throw new Error(`Static export contains forbidden text: ${forbidden}`);
}
console.log("Static export smoke test passed");
