import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public identity, editorial writing, and public social surfaces are source-safe", async () => {
  const [page, blog, article, layout, linkedIn, linkedInWidget, activitySummary, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../content/linkedin-posts.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/social/LinkedInWidget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivitySummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Joshua Nguyen/);
  assert.match(page, /FDE, AI Developer, and Technical Researcher\./);
  assert.match(page, /building and testing systems across the stack/);
  assert.match(page, /malformed JSON/);
  assert.match(page, /one distributed system/);
  assert.match(page, /Making Tuesday remember what Monday taught/);
  assert.match(page, /Obsidian Research Agent/);
  assert.match(page, /Engineering Activity Portfolio/);
  assert.match(page, /Environmental Quality ML Dashboard/);
  assert.match(page, /Book Service API/);
  const projectOrder = [
    "Obsidian Research Agent",
    "Engineering Activity Portfolio",
    "Environmental Quality ML Dashboard",
    "Book Service API",
  ].map((project) => page.indexOf(project));
  assert.ok(projectOrder.every((position) => position >= 0));
  assert.deepEqual(projectOrder, [...projectOrder].sort((a, b) => a - b));
  assert.ok(page.indexOf('className="work-section"') < page.indexOf('className="activity-section"'));
  assert.ok(page.indexOf('className="activity-section"') < page.indexOf('className="writing-section home-writing"'));
  assert.ok(page.indexOf('className="writing-section home-writing"') < page.indexOf('className="contact-section"'));
  assert.doesNotMatch(page, /className="interests-section"/);
  assert.equal((page.match(/interests\.map/g) ?? []).length, 1);
  assert.match(page, /className="mobile-nav"/);
  assert.match(page, /What it taught me/);
  assert.doesNotMatch(`${page}${blog}${article}${linkedInWidget}`, /[↗↘←→]|[\u{1F300}-\u{1FAFF}]/u);
  assert.match(blog, /Coming soon/);
  assert.match(blog, /First piece in progress/);
  assert.doesNotMatch(blog, /placeholder|lorem ipsum/i);
  assert.doesNotMatch(`${page}${layout}`, /Josh B\./);
  assert.match(layout, /Newsreader/);
  assert.match(layout, /https:\/\/joshuanguyen123\.github\.io/);
  assert.match(linkedIn, /linkedInPosts: ExternalPost\[\] = defineExternalPosts\(\[\]\)/);
  assert.match(linkedIn, /linkedin\.com\/in\/joshua-nguyen-6a812a210/);
  assert.match(activitySummary, /Cursor observed days/);
  assert.match(activitySummary, /session records \+ privacy-reduced usage-date evidence/);
  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 760px)"), styles.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(mobileStyles, /\.home-writing \.writing-list > a,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(mobileStyles, /\.home-writing \.writing-list > a\s*\{[^}]*gap:\s*18px/);
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
  assert.match(dashboard, /shouldUseActivitySnapshot/);
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
