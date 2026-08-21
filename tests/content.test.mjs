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
