import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public identity, editorial writing, and public social surfaces are source-safe", async () => {
  const [page, blog, article, layout, linkedIn, linkedInWidget, activitySummary, styles, site, header, footer, notFound] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../content/linkedin-posts.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/social/LinkedInWidget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivitySummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../content/site.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/site/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/site/SiteFooter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8"),
  ]);
  const summaryCards = await readFile(new URL("../lib/activity/summary-cards.ts", import.meta.url), "utf8");
  const definitions = await readFile(new URL("../components/activity/ActivityDefinitions.tsx", import.meta.url), "utf8");
  assert.match(page, /Joshua Nguyen/);
  assert.match(page, /Forward-deployed engineer, AI developer, and technical researcher\./);
  assert.match(page, /building and testing systems across the stack/);
  assert.match(page, /bounded and debuggable/);
  assert.match(page, /a small distributed system/);
  assert.match(page, /Tuesday's lesson to depend on what Monday showed/);
  // Copy is written plainly: no em dashes anywhere in the home page source.
  assert.doesNotMatch(page, /\u2014/);
  assert.match(page, /Obsidian Research Agent/);
  assert.match(page, /Engineering Activity Portfolio/);
  assert.match(page, /Research Agent Platform/);
  const projectOrder = [
    "Obsidian Research Agent",
    "Research Agent Platform",
    "Teach Anything",
    "Autonomous Repository Template",
    "Great Outdoors Intelligence",
    "Engineering Activity Portfolio",
    "Ladybug",
  ].map((project) => page.indexOf(project));
  assert.ok(projectOrder.every((position) => position >= 0));
  assert.deepEqual(projectOrder, [...projectOrder].sort((a, b) => a - b));
  assert.ok(page.indexOf('className="work-section"') < page.indexOf('className="activity-section"'));
  assert.ok(page.indexOf('className="activity-section"') < page.indexOf('className="writing-section home-writing"'));
  assert.ok(page.indexOf('className="writing-section home-writing"') < page.indexOf('className="contact-section"'));
  assert.doesNotMatch(page, /className="interests-section"/);
  assert.equal((page.match(/interests\.map/g) ?? []).length, 1);
  // One shared header and footer on every public page, with the mobile menu
  // included, so no route can quietly lose its navigation again.
  assert.match(header, /className="mobile-nav"/);
  assert.match(header, /aria-current=\{link\.key === current \? "page" : undefined\}/);
  for (const source of [page, blog, article, notFound]) {
    assert.match(source, /<SiteHeader/);
    assert.match(source, /<SiteFooter/);
    assert.match(source, /id="main"/);
  }
  assert.match(layout, /className="skip-link" href="#main"/);
  assert.match(footer, /GitHub/);
  // No Resume link ships until the PDF exists; the slot is the config value.
  assert.match(site, /export const resumeUrl: string \| null = null;/);
  assert.match(header, /resumeUrl \? <a/);
  assert.match(page, /What it taught me/);
  // Every project renders: featured entries plus compact cards, one tile each,
  // with a real link (never a styled <strong>) and an image slot for later.
  const tile = await readFile(new URL("../components/work/ProjectTile.tsx", import.meta.url), "utf8");
  assert.match(page, /projects\.slice\(0, FEATURED_PROJECTS\)/);
  assert.match(page, /projects\.slice\(FEATURED_PROJECTS\)/);
  assert.doesNotMatch(page, /<strong><span>View project/);
  assert.match(page, /className="project-link project-link--external"/);
  assert.match(page, /image\?: string;/);
  assert.match(tile, /project-tile--image/);
  assert.match(tile, /aria-hidden="true"/);
  assert.doesNotMatch(`${page}${blog}${article}${linkedInWidget}${header}${footer}${notFound}`, /[↗↘←→]|[\u{1F300}-\u{1FAFF}]/u);
  assert.doesNotMatch(blog, /Coming soon|placeholder|lorem ipsum/i);
  assert.doesNotMatch(`${page}${layout}`, /Josh B\./);
  assert.match(layout, /Newsreader/);
  assert.match(site, /https:\/\/joshuanguyen123\.github\.io/);
  assert.match(layout, /metadataBase: new URL\(siteUrl\)/);
  assert.match(layout, /colorScheme: "light"/);
  assert.match(layout, /apple: "\/apple-touch-icon\.png"/);
  assert.match(linkedIn, /linkedInPosts: ExternalPost\[\] = defineExternalPosts\(\[\]\)/);
  assert.match(linkedIn, /linkedin\.com\/in\/joshua-nguyen-6a812a210/);
  // Card labels and notes live in the shared summary-cards module so the
  // dashboard and /activity can never drift apart; both surfaces must use it.
  assert.match(summaryCards, /Cursor observed days/);
  assert.match(summaryCards, /session records \+ privacy-reduced usage-date evidence/);
  assert.match(activitySummary, /from "@\/lib\/activity\/summary-cards"/);
  assert.match(definitions, /from "@\/lib\/activity\/summary-cards"/);
  assert.match(definitions, /summaryCardExplanations/);
  // Font stacks must be declared on body: next/font puts --font-newsreader and
  // --font-geist-sans on the body class, and a token declared on :root cannot
  // see them, which once dropped the whole site to Times New Roman.
  assert.match(styles, /body \{[^}]*--font-serif: var\(--font-newsreader\)/);
  assert.match(styles, /body \{[^}]*--font-sans: var\(--font-geist-sans\)/);
  assert.doesNotMatch(styles.slice(0, styles.indexOf("body {")), /--font-(serif|sans):/);
  // Every size and colour comes from the token block; raw literals are the drift this guards against.
  const normalizedStyles = styles.replace(/\r\n/g, "\n");
  const afterTokens = normalizedStyles.slice(normalizedStyles.indexOf("\n}\n") + 3);
  assert.doesNotMatch(afterTokens, /font-size: \d+px/);
  assert.doesNotMatch(afterTokens, /#[0-9a-f]{6}\b/i);
  assert.doesNotMatch(afterTokens, /font-family: var\(--font-geist-sans\)/);
  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 760px)"), styles.indexOf("@media (prefers-reduced-motion: reduce)"));
  // Notes are full-width rows with inline meta; the old two-column row once
  // squeezed the summary into a 51px column on phones.
  assert.match(styles, /\.writing-list > a \{[^}]*display: block/);
  assert.match(page, /className="writing-meta"/);
  assert.doesNotMatch(mobileStyles, /\.writing-list/);
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
  assert.match(dashboard, /Every square is one calendar day: home base America\/Denver, living-local when I travel/);
  assert.match(dashboard, /observed activity, not productivity/);
  assert.match(dashboard, /activityTimestampFormatter/);
  // Still an explicit zone rather than the viewer's locale -- it is now taken
  // from the snapshot instead of hard-coded, so timestamps read in the zone the
  // data was actually bucketed in.
  assert.match(dashboard, /activityTimestampFormatter = \(timeZone: string\) =>/);
  assert.match(dashboard, /new Intl\.DateTimeFormat\("en-US", \{\s+timeZone,/);
  assert.doesNotMatch(dashboard, /new Date\([^)]*\)\.toLocaleString\(\)/);
  assert.match(parser, /hasExactKeys/);
  assert.match(parser, /aggregate-v6/);
});
