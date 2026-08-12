import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public identity and future-ready empty social surfaces are source-safe", async () => {
  const [page, layout, linkedIn] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../content/linkedin-posts.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Joshua Nguyen/);
  assert.match(page, /JN<span>\/</);
  assert.match(page, /Josh N\./);
  assert.doesNotMatch(`${page}${layout}`, /Josh B\./);
  assert.match(layout, /https:\/\/joshuanguyen123\.github\.io/);
  assert.match(linkedIn, /linkedInPosts: ExternalPost\[\] = defineExternalPosts\(\[\]\)/);
  assert.match(linkedIn, /linkedInProfileUrl: string \| null = null/);
});

test("static architecture has no runtime activity API", async () => {
  const [config, packageJson] = await Promise.all([
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(config, /output: "export"/);
  assert.doesNotMatch(packageJson, /vinext|cloudflare|drizzle|wakatime/i);
});
