import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryFile = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("pull-request verification cannot reach provider secrets or deployment authority", async () => {
  const workflow = await repositoryFile(".github/workflows/pages.yml");
  const prStart = workflow.indexOf("  pr-verify:");
  const trustedStart = workflow.indexOf("  build:");
  const deployStart = workflow.indexOf("  deploy:");
  assert.ok(prStart > 0 && trustedStart > prStart && deployStart > trustedStart);

  const global = workflow.slice(0, prStart);
  const pullRequestJob = workflow.slice(prStart, trustedStart);
  const trustedBuild = workflow.slice(trustedStart, deployStart);
  const deployJob = workflow.slice(deployStart);

  assert.doesNotMatch(global, /pages:\s*write|id-token:\s*write|secrets\./);
  assert.match(pullRequestJob, /if:\s*github\.event_name == 'pull_request'/);
  assert.match(pullRequestJob, /contents:\s*read/);
  assert.match(pullRequestJob, /persist-credentials:\s*false/);
  assert.doesNotMatch(pullRequestJob, /pages:\s*write|id-token:\s*write|secrets\./);
  assert.match(trustedBuild, /if:\s*github\.event_name != 'pull_request'/);
  assert.match(trustedBuild, /secrets\.ACTIVITY_GITHUB_TOKEN/);
  assert.match(trustedBuild, /secrets\.CURSOR_ADMIN_API_KEY/);
  assert.match(deployJob, /pages:\s*write/);
  assert.match(deployJob, /id-token:\s*write/);
});

test("admin UI keeps bearer sessions in memory and blocks framed operation", async () => {
  const source = await repositoryFile("components/blog/AdminEditor.tsx");
  assert.doesNotMatch(source, /sessionStorage|localStorage/);
  assert.match(source, /window\.top !== window\.self/);
  assert.match(source, /Publish these changes to the public site/);
  assert.match(source, /published revisions remain in Git history/i);
});

test("contact form prefers the verifying worker and only falls back while it is unconfigured", async () => {
  const form = await repositoryFile("components/contact/ContactForm.tsx");
  const policy = await repositoryFile("app/layout.tsx");
  assert.match(form, /NEXT_PUBLIC_CONTACT_API_URL/);
  assert.match(form, /captchaToken/);
  // Configuring the worker must switch the destination, not merely add one.
  assert.match(form, /usesWorker \? CONTACT_API_URL : "https:\/\/api\.web3forms\.com\/submit"/);
  assert.match(form, /const usesWorker = Boolean\(CONTACT_API_URL && HCAPTCHA_SITE_KEY\)/);
  // The provider origin is admitted only for as long as that fallback is live.
  const web3formsLines = policy.split("\n").filter((line) => line.includes("api.web3forms.com"));
  assert.ok(web3formsLines.length > 0, "the fallback still needs its origin");
  for (const line of web3formsLines) {
    assert.match(line, /contactUsesWorker \?|const web3formsOrigin/, "the provider origin must never be unconditional");
  }
});

test("the contact form is never dropped from the page when a backend is configured", async () => {
  const form = await repositoryFile("components/contact/ContactForm.tsx");
  // Rendering nothing is reserved for the case where there is genuinely nowhere
  // to post; either backend must keep the form on the page.
  assert.match(form, /const isConfigured = usesWorker \|\| Boolean\(WEB3FORMS_KEY\)/);
  assert.match(form, /if \(!isConfigured\) return null;/);
  assert.equal((form.match(/return null;/g) ?? []).length, 1, "only the unconfigured case may render nothing");

  const smoke = await repositoryFile("scripts/smoke-export.mjs");
  assert.match(smoke, /contact-form/, "the export smoke test must prove the form shipped");
});

test("scheduled collector runs from a copied owner-only dependency closure", async () => {
  const installer = await repositoryFile("scripts/install-live-activity-task.ps1");
  assert.match(installer, /collector-runtime/);
  assert.match(installer, /Get-ChildItem[^\n]+\*\.mjs/);
  assert.match(installer, /data\\history-backfill\.json/);
  assert.match(installer, /icacls[^\n]+\/inheritance:r/);
  assert.match(installer, /New-ScheduledTaskAction[^\n]+\$hiddenRunner/);
  assert.doesNotMatch(installer, /New-ScheduledTaskAction[^\n]+\$PSScriptRoot/);
});
