import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { getPublishedPosts } from "../lib/blog.ts";

test("blog supports zero posts and multiple validated non-draft posts", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-blog-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(getPublishedPosts(root), []);
  const post = (slug, date, draft = false, body = "## Evidence\n\nBody.") => `---\nslug: ${slug}\ntitle: ${slug} title\nsummary: A real summary.\npublishedAt: ${date}\ntags:\n  - engineering\ndraft: ${draft}\n---\n\n${body}`;
  await writeFile(path.join(root, "one.md"), post("one", "2026-08-10"));
  await writeFile(path.join(root, "two.md"), post("two", "2026-08-11"));
  await writeFile(path.join(root, "draft.md"), post("draft", "2026-08-12", true));
  const published = getPublishedPosts(root);
  assert.deepEqual(published.map(({ slug }) => slug), ["two", "one"]);
  assert.match(published[0].html, /<h2>Evidence<\/h2>/);
  assert.equal(published[0].readingMinutes, 1);

  await writeFile(path.join(root, "long.md"), post("long", "2026-08-13", false, "word ".repeat(221)));
  assert.equal(getPublishedPosts(root)[0].readingMinutes, 2);
});

test("blog rejects malformed or unexpected frontmatter", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-blog-invalid-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "bad.md"), "---\nslug: Bad Slug\ntitle: Bad\nsummary: Bad\npublishedAt: yesterday\ntags: []\ndraft: false\nprivatePath: C:/secret\n---\nBody");
  assert.throws(() => getPublishedPosts(root), /Unknown blog frontmatter/);
});

test("heatmap exposes exact keyboard, pointer, tooltip, and source-status hooks", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../components/activity/ActivityHeatmap.tsx", import.meta.url), "utf8");
  for (const expected of ["aria-label", "aria-pressed", "data-level", "title=", "onClick", "onFocus", "onMouseEnter", "no source coverage"]) {
    assert.ok(source.includes(expected), `heatmap is missing ${expected}`);
  }
});

test("post markdown cannot ship script, event handlers, or javascript: URIs", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-blog-xss-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const body = [
    "<script>alert('a')</script>",
    "<img src=x onerror=\"alert('b')\">",
    "<a href=\"javascript:alert('c')\">click</a>",
    "<iframe src=\"https://evil.example/\"></iframe>",
    "<svg onload=\"alert('d')\"></svg>",
    "<form action=\"javascript:alert('e')\"><button formaction=\"javascript:alert('f')\">go</button></form>",
    "<object data=\"javascript:alert('g')\"></object>",
    "",
    "Normal **bold**, `code`, and a [safe link](https://example.com).",
    "",
    "## A heading",
  ].join("\n");
  await writeFile(
    path.join(root, "probe.md"),
    `---\nslug: probe\ntitle: Probe\nsummary: A real summary.\npublishedAt: 2026-08-23\ntags:\n  - engineering\ndraft: false\n---\n\n${body}`,
  );

  const [post] = getPublishedPosts(root);
  const html = post.html.toLowerCase();
  for (const payload of ["<script", "onerror", "onload", "javascript:", "<iframe", "<svg", "<form", "formaction", "<object"]) {
    assert.ok(!html.includes(payload), `sanitizer leaked ${payload}: ${post.html}`);
  }
  // Legitimate editorial markup must survive.
  assert.match(post.html, /<strong>bold<\/strong>/);
  assert.match(post.html, /<code>code<\/code>/);
  assert.match(post.html, /<h2[^>]*>A heading<\/h2>/);
  assert.match(post.html, /href="https:\/\/example\.com"/);
  // Outbound links get hardened rather than dropped.
  assert.match(post.html, /rel="noreferrer noopener"/);
});

test("post link hardening uses exact origins and ignores author-supplied window controls", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-blog-links-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const body = [
    '<a href="https://joshuanguyen123.github.io@evil.example/path" target="named" rel="opener">credential-shaped host</a>',
    '<a href="https://evil.example/?next=joshuanguyen123.github.io" target="named">query trick</a>',
    '<a href="https://joshuanguyen123.github.io/blog/" target="_blank" rel="opener">internal</a>',
  ].join("\n");
  await writeFile(path.join(root, "links.md"), `---\nslug: links\ntitle: Links\nsummary: Link checks.\npublishedAt: 2026-08-25\ntags: [security]\ndraft: false\n---\n\n${body}`);
  const html = getPublishedPosts(root)[0].html;
  assert.match(html, /href="https:\/\/joshuanguyen123\.github\.io@evil\.example\/path" target="_blank" rel="noreferrer noopener"/);
  assert.match(html, /href="https:\/\/evil\.example\/\?next=joshuanguyen123\.github\.io" target="_blank" rel="noreferrer noopener"/);
  assert.match(html, /href="https:\/\/joshuanguyen123\.github\.io\/blog\/">internal<\/a>/);
  assert.doesNotMatch(html, /target="named"|rel="opener"/);
});
