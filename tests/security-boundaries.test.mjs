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

test("contact form sends only to the server-side verification boundary", async () => {
  const form = await repositoryFile("components/contact/ContactForm.tsx");
  const policy = await repositoryFile("app/layout.tsx");
  assert.match(form, /NEXT_PUBLIC_CONTACT_API_URL/);
  assert.match(form, /captchaToken/);
  assert.doesNotMatch(form, /NEXT_PUBLIC_WEB3FORMS_KEY|api\.web3forms\.com|access_key/);
  assert.doesNotMatch(policy, /api\.web3forms\.com/);
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
