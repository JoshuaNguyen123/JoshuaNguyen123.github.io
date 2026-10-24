import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateReleaseConfiguration } from "../scripts/release-config.mjs";
import { verifyContactExport } from "../scripts/verify-contact-export.mjs";
import { validateTrackedRepository } from "../scripts/validate-public-repo.mjs";

test("release candidates reject missing or partial contact configuration", () => {
  for (const env of [{}, { NEXT_PUBLIC_CONTACT_API_URL: "https://example.com/api/contact" }, { NEXT_PUBLIC_HCAPTCHA_SITE_KEY: "public-site-key", NEXT_PUBLIC_WEB3FORMS_KEY: "public-fallback" }]) {
    assert.throws(() => validateReleaseConfiguration(env));
  }
  assert.equal(validateReleaseConfiguration({ NEXT_PUBLIC_WEB3FORMS_KEY: "public-fallback" }).contactMode, "web3forms");
  assert.equal(validateReleaseConfiguration({ NEXT_PUBLIC_CONTACT_API_URL: "https://example.com/api/contact", NEXT_PUBLIC_HCAPTCHA_SITE_KEY: "public-site-key" }).contactMode, "worker");
});

test("production configuration rejects local origins, credentials, and empty optional URLs", () => {
  for (const url of ["http://localhost:4182", "https://127.0.0.1/contact", "https://user:password@example.com/contact", ""]) {
    assert.throws(() => validateReleaseConfiguration({ NEXT_PUBLIC_WEB3FORMS_KEY: "public-fallback", NEXT_PUBLIC_ACTIVITY_FEED_URL: url }));
  }
});

test("the release checks captcha in the exported form and its browser policy", () => {
  const env = { NEXT_PUBLIC_CONTACT_API_URL: "https://example.com/api/contact", NEXT_PUBLIC_HCAPTCHA_SITE_KEY: "public-site-key" };
  const policy = ["script-src", "frame-src", "connect-src", "style-src"].map((name) => `${name} 'self' https://hcaptcha.com https://*.hcaptcha.com`).join("; ");
  const html = `<meta http-equiv="Content-Security-Policy" content="${policy}"><form class="contact-form" data-contact-configured="true"><div class="h-captcha" data-sitekey="public-site-key" data-size="compact"></div></form>`;
  assert.doesNotThrow(() => verifyContactExport(html, env));
  const escaped = html.replaceAll("'", "&#x27;");
  assert.doesNotThrow(() => verifyContactExport(escaped, env));
  assert.doesNotThrow(() => verifyContactExport(html.replaceAll("'", "&#39;"), env));
  assert.throws(() => verifyContactExport(escaped.replace(" https://*.hcaptcha.com", ""), env), /script-src blocks/);
  assert.throws(() => verifyContactExport(html.replace(/<div.*<\/div>/, ""), env), /missing its compact captcha/);
  assert.throws(() => verifyContactExport(html.replace('data-sitekey="public-site-key"', 'data-sitekey="other-key"'), env), /does not match/);
  assert.throws(() => verifyContactExport(html.replace("compact", "normal"), env), /missing its compact captcha/);
  assert.throws(() => verifyContactExport(html.replace("frame-src 'self' https://hcaptcha.com https://*.hcaptcha.com", "frame-src 'self'"), env), /frame-src blocks/);
  assert.throws(() => verifyContactExport(html.replace('data-contact-configured="true"', 'data-contact-configured="false"'), env), /backend did not reach/);
  const direct = { NEXT_PUBLIC_WEB3FORMS_KEY: "public-fallback" };
  assert.throws(() => verifyContactExport(html, direct), /does not match/);
  assert.doesNotThrow(() => verifyContactExport(html.replace('data-sitekey="public-site-key"', 'data-sitekey="50b2fe65-b00b-4b9e-ad62-3ba471098be2"'), direct));
});

test("candidate safety checks include new public files while excluding ignored local configuration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "portfolio-release-"));
  try {
    assert.equal(spawnSync("git", ["init", "--quiet", directory], { windowsHide: true }).status, 0);
    await writeFile(path.join(directory, ".gitignore"), ".env.local\noutputs/\n");
    await writeFile(path.join(directory, ".env.local"), "LOCAL_ONLY=fixture\n");
    await mkdir(path.join(directory, "public"));
    await writeFile(path.join(directory, "public", "unreviewed.png"), "fixture");
    assert.deepEqual((await validateTrackedRepository(directory)).paths, []);
    const candidate = await validateTrackedRepository(directory, { includeUntracked: true });
    assert.ok(candidate.paths.includes("public/unreviewed.png"));
    assert.ok(!candidate.paths.includes(".env.local"));
    assert.deepEqual(candidate.violations.map((item) => item.path), ["public/unreviewed.png"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a frozen release reconciles to Git history and rejects changed calendar coverage", async () => {
  const good = spawnSync(process.execPath, ["scripts/audit-activity.mjs", "--published-snapshot"], { encoding: "utf8", windowsHide: true });
  assert.equal(good.status, 0, good.stderr);
  const directory = await mkdtemp(path.join(tmpdir(), "portfolio-frozen-"));
  try {
    const snapshot = JSON.parse(await readFile("public/data/activity.json", "utf8"));
    snapshot.providers.github.metrics.contributions.coverage.start = "2025-01-01";
    const file = path.join(directory, "changed.json");
    await writeFile(file, JSON.stringify(snapshot));
    const bad = spawnSync(process.execPath, ["scripts/audit-activity.mjs", file, "--published-snapshot"], { encoding: "utf8", windowsHide: true });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /coverage/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
