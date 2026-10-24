import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createStaticPreview } from "./preview.mjs";

const outRoot = path.resolve("out");
const server = createStaticPreview(outRoot);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Smoke server failed to bind");
  const origin = `http://127.0.0.1:${address.port}`;
  const [rootResponse, dashboardResponse, dataResponse] = await Promise.all([fetch(`${origin}/`), fetch(`${origin}/activity/index.html`), fetch(`${origin}/data/activity.json`)]);
  if (!rootResponse.ok || !dashboardResponse.ok || !dataResponse.ok) throw new Error("Static export did not serve successfully");
  const [html, dashboardHtml, activity] = await Promise.all([rootResponse.text(), dashboardResponse.text(), dataResponse.json()]);
  const homeActivitySection = html.match(/<section\b[^>]*\bid="activity"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  if (!homeActivitySection || !/<a\b[^>]*\bhref="\/activity\/"/.test(homeActivitySection)) throw new Error("Served homepage activity summary is missing its dashboard link");
  if (!dashboardHtml.includes("Codex session-days") || !dashboardHtml.includes("Observed activity") || dashboardHtml.includes("Cursor applied AI line changes") || html.includes("Cursor applied AI line changes")) {
    throw new Error("Served dashboard is missing reconciled activity labels");
  }
  if (activity.schemaVersion !== 6 || activity.privacyVersion !== "aggregate-v6" || !activity.providers?.codex?.metrics?.repositoryEvidence || !activity.providers?.cursor?.metrics?.activeSessions || !activity.providers?.cursor?.metrics?.usagePresence || !activity.providers?.cursor?.metrics?.appliedLineChanges || !activity.providers?.["claude-code"]?.metrics?.repositoryEvidence) {
    throw new Error("Served activity snapshot has an unexpected reconciliation state");
  }
  const pages = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), prefix + entry.name + "/");
      else if (entry.name.endsWith(".html")) pages.push(prefix + entry.name);
    }
  }
  await walk(outRoot);
  const destinations = new Set();
  for (const page of pages) {
    const url = "/" + page.replace(/index\.html$/, "");
    const response = await fetch(origin + url);
    if (response.status !== 200) throw new Error(`Exported route failed: ${url}`);
    const source = await readFile(path.join(outRoot, page), "utf8");
    for (const match of source.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      if (!match[1].startsWith("//")) destinations.add(match[1].replaceAll("&amp;", "&"));
    }
  }
  for (const destination of destinations) {
    const response = await fetch(origin + destination, { method: "HEAD" });
    if (!response.ok) throw new Error(`Missing internal asset or destination: ${destination}`);
  }
  const missing = await fetch(origin + "/missing-candidate-page/");
  if (missing.status !== 404 || !(await missing.text()).includes("That page isn")) throw new Error("Branded 404 failed");
  const post = await fetch(origin + "/", { method: "POST", body: "fixture" });
  if (post.status !== 405) throw new Error("Static preview must reject form POSTs");
  console.log(`Local production HTTP smoke test passed: ${pages.length} pages, ${destinations.size} internal destinations, branded 404 and static POST boundary.`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
