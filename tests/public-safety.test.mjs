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
    file(".env.local", "TOKEN=local"),
    file("certificates/signing.p12"),
  ]);
  assert.equal(violations.length, 4);
});

test("reviewed empty environment examples remain allowed", () => {
  const violations = validatePublicFiles([
    file(".env.example", "GITHUB_TOKEN=\n"),
    file(".env.live.example", "GITHUB_REPOSITORY=owner/repository\nGITHUB_PUBLISH_TOKEN=\n"),
  ]);
  assert.deepEqual(violations, []);
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
