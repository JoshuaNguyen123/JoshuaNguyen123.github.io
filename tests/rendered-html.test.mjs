import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public identity, editorial writing, and future-ready empty social surfaces are source-safe", async () => {
  const [page, blog, layout, linkedIn] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../content/linkedin-posts.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Joshua Nguyen/);
  assert.match(page, /FDE, AI developer, and technical researcher\./);
  assert.match(page, /Obsidian Research Agent/);
  assert.match(page, /Environmental Quality ML Dashboard/);
  assert.match(page, /Book Service API/);
  assert.match(blog, /Coming soon/);
  assert.match(blog, /First piece in progress/);
  assert.doesNotMatch(blog, /placeholder|lorem ipsum/i);
  assert.doesNotMatch(`${page}${layout}`, /Josh B\./);
  assert.match(layout, /Newsreader/);
  assert.match(layout, /https:\/\/joshuanguyen123\.github\.io/);
  assert.match(linkedIn, /linkedInPosts: ExternalPost\[\] = defineExternalPosts\(\[\]\)/);
  assert.match(linkedIn, /linkedInProfileUrl: string \| null = null/);
});

test("static architecture keeps a validated public live-feed fallback without a server API", async () => {
  const [config, packageJson, dashboard, parser] = await Promise.all([
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivityDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/activity/live-snapshot.ts", import.meta.url), "utf8"),
  ]);
  assert.match(config, /output: "export"/);
  assert.doesNotMatch(packageJson, /vinext|cloudflare|drizzle|wakatime/i);
  assert.match(dashboard, /parseActivitySnapshot/);
  assert.match(dashboard, /cache: "no-store"/);
  assert.match(dashboard, /Verified bundled snapshot/);
  assert.match(dashboard, /Observed activity/);
  assert.match(dashboard, /Usage evidence/);
  assert.match(dashboard, /Each heatmap square is one America\/Denver calendar date/);
  assert.match(dashboard, /activityTimestampFormatter/);
  assert.match(dashboard, /timeZone: "America\/Denver"/);
  assert.doesNotMatch(dashboard, /new Date\([^)]*\)\.toLocaleString\(\)/);
  assert.match(parser, /hasExactKeys/);
  assert.match(parser, /aggregate-v5/);
});
