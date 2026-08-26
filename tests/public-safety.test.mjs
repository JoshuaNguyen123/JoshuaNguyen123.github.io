import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicFiles, validateTrackedRepository } from "../scripts/validate-public-repo.mjs";

function file(path, contents = "") {
  return { path, contents: Buffer.from(contents, "utf8") };
}

test("current tracked repository is public-safe", async () => {
  const { violations } = await validateTrackedRepository();
  assert.deepEqual(violations, []);
});

test("agent instructions, real environment files, and key containers are rejected", () => {
  const violations = validatePublicFiles([
    file("AGENTS.md", "local guidance"),
    file("nested/CLAUDE.md", "local guidance"),
    file(".claude/launch.json", "{}"),
    file(".env.local", "TOKEN=local"),
    file("certificates/signing.p12"),
  ]);
  assert.equal(violations.length, 5);
});

test("reviewed empty environment examples remain allowed", () => {
  const violations = validatePublicFiles([
    file(".env.example", "GITHUB_TOKEN=\n"),
    file(".env.live.example", "GITHUB_REPOSITORY=owner/repository\nGITHUB_PUBLISH_TOKEN=\n"),
  ]);
  assert.deepEqual(violations, []);
});

test("internal docs, duplicate snapshots, and unapproved public assets are rejected", () => {
  const violations = validatePublicFiles([
    file("README.md", "public repository overview"),
    file("content/blog/real-post.md", "published article"),
    file("design-qa.md", "internal review"),
    file("content/blog/_README.md", "authoring instructions"),
    file("activity.json", "{}"),
    file("public/unused.png"),
  ]);
  assert.deepEqual(violations.map(({ path }) => path), [
    "design-qa.md",
    "content/blog/_README.md",
    "activity.json",
    "public/unused.png",
  ]);
});

test("blog drafts cannot be tracked in the public repository", () => {
  const violations = validatePublicFiles([
    file("content/blog/private-notes.md", "---\nslug: private-notes\ndraft: true\n---\nPrivate"),
    file("content/blog/spaced-private-notes.md", "---\nslug: spaced-private-notes\ndraft : true\n---\nPrivate"),
    file("content/blog/public-post.md", "---\nslug: public-post\ndraft: false\n---\nPublic"),
  ]);
  assert.deepEqual(violations, [
    { path: "content/blog/private-notes.md", reason: "private draft is tracked in the public repository" },
    { path: "content/blog/spaced-private-notes.md", reason: "private draft is tracked in the public repository" },
  ]);
});

test("recognized credential shapes are rejected without retaining their values", () => {
  const samples = [
    "github" + "_pat_" + "A".repeat(48),
    "sk-" + "proj-" + "A".repeat(32),
    "sk-" + "ant-" + "A".repeat(32),
    "AKIA" + "A".repeat(16),
    "AIza" + "A".repeat(35),
    "xoxb-" + "A".repeat(20),
    "sk_" + "live_" + "A".repeat(24),
    "sb_" + "secret_" + "A".repeat(24),
    "npm_" + "A".repeat(36),
    "-----BEGIN " + "PRIVATE KEY-----",
  ];
  const violations = validatePublicFiles(samples.map((sample, index) => file(`fixture-${index}.txt`, sample)));
  assert.equal(violations.length, samples.length);
});
