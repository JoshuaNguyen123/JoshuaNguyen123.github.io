import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public identity, editorial writing, and public social surfaces are source-safe", async () => {
  const [page, blog, article, work, layout, linkedIn, linkedInWidget, activitySummary, styles, site, projects, header, footer, notFound] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/work/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../content/linkedin-posts.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/social/LinkedInWidget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivitySummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../content/site.ts", import.meta.url), "utf8"),
    readFile(new URL("../content/projects.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/site/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/site/SiteFooter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8"),
  ]);
  const summaryCards = await readFile(new URL("../lib/activity/summary-cards.ts", import.meta.url), "utf8");
  const definitions = await readFile(new URL("../components/activity/ActivityDefinitions.tsx", import.meta.url), "utf8");
  // The name renders in the shared header; the page carries it as structured data.
  assert.match(site, /siteName = "Joshua Nguyen"/);
  assert.match(page, /name: siteName/);
  assert.match(page, /I build research agents and retrieval systems that show their work\./);
  const workIndex = await readFile(new URL("../components/work/WorkIndex.tsx", import.meta.url), "utf8");
  assert.match(page, /I work across the stack/);
  assert.match(projects, /bounded and debuggable/);
  assert.match(projects, /a small distributed system/);
  assert.match(projects, /Tuesday's lesson to depend on what Monday showed/);
  // Copy is written plainly: no em dashes anywhere in the home page source.
  assert.doesNotMatch(page, /\u2014/);
  assert.doesNotMatch(projects, /\u2014/);
  assert.match(projects, /Obsidian Research Agent/);
  assert.match(projects, /Engineering Activity Portfolio/);
  assert.match(projects, /Research Agent Platform/);
  const projectOrder = [
    "Obsidian Research Agent",
    "Ladybug",
    "Personal AI Digest",
    "Teach Anything",
    "Research Agent Platform",
    "Autonomous Repository Template",
    "Engineering Activity Portfolio",
    "Great Outdoors Intelligence",
    "Local-First Meeting Transcription",
  ].map((project) => projects.indexOf(project));
  assert.ok(projectOrder.every((position) => position >= 0));
  assert.deepEqual(projectOrder, [...projectOrder].sort((a, b) => a - b));
  // Selected work (the WorkIndex section) leads; contact closes the page.
  assert.match(workIndex, /id="work"/);
  const sectionOrder = [page.indexOf("<WorkIndex"), ...["more", "writing", "activity", "contact"].map((id) => page.indexOf(`id="${id}"`))];
  assert.ok(sectionOrder.every((position) => position >= 0));
  assert.deepEqual(sectionOrder, [...sectionOrder].sort((a, b) => a - b));
  // The scroll-linked index never takes over scrolling: one passive,
  // frame-throttled listener, with in-page links as the no-JS fallback.
  assert.match(workIndex, /\{ passive: true \}/);
  assert.match(workIndex, /requestAnimationFrame/);
  assert.match(workIndex, /href=\{`#project-\$\{project\.slug\}`\}/);
  assert.doesNotMatch(workIndex, /preventDefault|scrollTo\(|wheel/);
  assert.doesNotMatch(page, /className="interests-section"/);
  assert.equal((page.match(/interests\.map/g) ?? []).length, 1);
  // One shared header and footer on every public page. The primary links wrap
  // on a phone instead of hiding behind a menu, so no stylesheet may hide them.
  assert.doesNotMatch(header, /MobileNav/);
  assert.doesNotMatch(styles, /\.site-header > nav \{[^}]*display: none/);
  assert.match(header, /aria-current=\{link\.key === current \? "page" : undefined\}/);
  for (const source of [page, blog, article, work, notFound]) {
    assert.match(source, /<SiteHeader/);
    assert.match(source, /<SiteFooter/);
    assert.match(source, /id="main"/);
  }
  assert.match(layout, /className="skip-link" href="#main"/);
  assert.match(footer, /GitHub/);
  // No Resume link ships until the PDF exists; the slot is the config value.
  assert.match(site, /export const resumeUrl: string \| null = null;/);
  assert.match(header, /resumeUrl \? <a/);
  assert.match(work, /What it taught me/);
  // Every project renders: featured entries plus compact cards, one tile each,
  // with a real link (never a styled <strong>) and an image slot for later.
  const tile = await readFile(new URL("../components/work/ProjectTile.tsx", import.meta.url), "utf8");
  assert.match(page, /projects\.slice\(0, FEATURED_PROJECTS\)/);
  assert.match(page, /projects\.slice\(FEATURED_PROJECTS\)/);
  assert.doesNotMatch(page, /<strong><span>View project/);
  assert.match(workIndex, /className="project-link project-link--external"/);
  assert.match(page, /href=\{`\/work\/\$\{project\.slug\}\/`\}/);
  assert.match(projects, /image: string;/);
  assert.match(work, /Architecture diagram of/);
  assert.match(tile, /project-tile--image/);
  assert.match(tile, /Architecture diagram of/);
  assert.match(tile, /aria-hidden="true"/);
  assert.doesNotMatch(`${page}${workIndex}${blog}${article}${work}${linkedInWidget}${header}${footer}${notFound}`, /[↗↘←→]|[\u{1F300}-\u{1FAFF}]/u);
  assert.doesNotMatch(workIndex, /—/);
  assert.doesNotMatch(blog, /Coming soon|placeholder|lorem ipsum/i);
  assert.doesNotMatch(`${page}${layout}`, /Josh B\./);
  assert.match(layout, /Archivo/);
  assert.doesNotMatch(layout, /Geist|Playfair|Inter\b/);
  assert.doesNotMatch(layout, /Newsreader/);
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
  // Font stacks must be declared on body: next/font puts --font-archivo
  // on the body class, and a token declared on :root cannot
  // see them, which once dropped the whole site to Times New Roman.
  assert.match(styles, /body \{[^}]*--font-sans: var\(--font-archivo\)/);
  assert.doesNotMatch(styles.slice(0, styles.indexOf("body {")), /--font-(serif|sans):/);
  // Every size and colour comes from the token block; raw literals are the drift this guards against.
  const normalizedStyles = styles.replace(/\r\n/g, "\n");
  const afterTokens = normalizedStyles.slice(normalizedStyles.indexOf("\n}\n") + 3);
  assert.doesNotMatch(afterTokens, /font-size: \d+px/);
  assert.doesNotMatch(afterTokens, /#[0-9a-f]{6}\b/i);
  assert.doesNotMatch(afterTokens, /font-family: var\(--font-archivo\)/);
  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 760px)"), styles.indexOf("@media (prefers-reduced-motion: reduce)"));
  // Notes are full-width rows with inline meta; the old two-column row once
  // squeezed the summary into a 51px column on phones.
  assert.match(styles, /\.writing-list > a \{[^}]*display: block/);
  assert.match(page, /className="writing-meta"/);
  assert.doesNotMatch(mobileStyles, /\.writing-list/);
});

test("static architecture keeps a validated public live-feed fallback without a server API", async () => {
  const [config, packageJson, dashboard, parser, feed, definitions, activityPage] = await Promise.all([
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivityDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/activity/live-snapshot.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivityFeedProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/activity/ActivityDefinitions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/activity/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(config, /output: "export"/);
  assert.doesNotMatch(packageJson, /vinext|cloudflare|drizzle|wakatime/i);
  assert.match(feed, /parseActivitySnapshot/);
  assert.match(feed, /shouldUseActivitySnapshot/);
  assert.match(feed, /cache: "no-store"/);
  assert.match(feed, /snapshot\.mode !== "observed"/);
  // Both activity surfaces must share one validated snapshot and freshness
  // status. A second polling owner can quietly show different live records.
  assert.equal((activityPage.match(/<ActivityFeedProvider /g) ?? []).length, 1);
  assert.match(activityPage, /<ActivityFeedProvider initialData=\{data\}>[\s\S]*<ActivityDashboard \/>[\s\S]*<ActivityDefinitions \/>[\s\S]*<\/ActivityFeedProvider>/);
  for (const consumer of [dashboard, definitions]) {
    assert.match(consumer, /const \{ data, feedState \} = useActivityFeed\(\)/);
    assert.doesNotMatch(consumer, /fetch\(|setInterval\(|parseActivitySnapshot|shouldUseActivitySnapshot/);
  }
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
