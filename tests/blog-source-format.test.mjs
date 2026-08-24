import assert from "node:assert/strict";
import test from "node:test";
import { buildBlogSource, isBlogSlug, parseBlogSource } from "../lib/blog/source-format.mjs";

const metadata = {
  slug: "a-real-post",
  title: "A real post",
  summary: "A concise summary.",
  publishedAt: "2026-08-24",
  tags: ["agents", "privacy"],
  draft: true,
};

test("admin blog source round-trips through the strict public format", () => {
  const source = buildBlogSource(metadata, "## Hello\n\nA body.");
  assert.deepEqual(parseBlogSource(source), { metadata, body: "\n## Hello\n\nA body.\n" });
});

test("admin blog source accepts the repository's block-list tags", () => {
  const source = `---\nslug: existing-post\ntitle: Existing post\nsummary: Existing summary\npublishedAt: 2026-08-21\ntags:\n  - building\n  - process\ndraft: false\n---\n\nBody.\n`;
  assert.deepEqual(parseBlogSource(source).metadata.tags, ["building", "process"]);
});

test("admin blog source rejects path escapes, unknown keys, and fake dates", () => {
  assert.equal(isBlogSlug("../secrets"), false);
  assert.throws(() => parseBlogSource(buildBlogSource(metadata, "Body").replace("draft: true", "draft: true\nowner: anyone")), /unknown frontmatter/);
  assert.throws(() => buildBlogSource({ ...metadata, publishedAt: "2026-02-31" }, "Body"), /real YYYY-MM-DD/);
});
