import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateReleaseConfiguration } from "./release-config.mjs";
import { readContentSecurityPolicy, verifyContactExport } from "./verify-contact-export.mjs";
import { validateTrackedRepository } from "./validate-public-repo.mjs";

// Build and package locally. This command has no publishing or deployment step.
const root = process.cwd();
const destination = path.join(root, "outputs", "releases", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(destination, { recursive: true });
const env = { ...process.env };
const receipt = { startedAt: new Date().toISOString(), node: process.version, deployed: false, steps: [], status: "running" };
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const execute = (command, args) => spawnSync(command, args, { cwd: root, env, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
async function sourceIdentity() {
  const { paths, violations } = await validateTrackedRepository(root, { includeUntracked: true });
  if (violations.length) throw new Error(violations.map((item) => `${item.path}: ${item.reason}`).join("\n"));
  const entries = await Promise.all(paths.map(async (file) => ({ path: file, sha256: digest(await readFile(path.join(root, file))) })));
  return { sha256: digest(JSON.stringify(entries)), files: entries.length };
}
async function run(name, args) {
  console.log(`Checking ${name}…`);
  const result = execute(process.execPath, args);
  await writeFile(path.join(destination, `${name}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}`);
  receipt.steps.push({ name, exitCode: result.status });
  if (result.error || result.status !== 0) throw new Error(`${name} failed. See ${path.join(destination, `${name}.log`)}`);
}
async function inventory(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await inventory(path.join(directory, entry.name), relative + "/"));
    else if (entry.isFile()) { const bytes = await readFile(path.join(directory, entry.name)); files.push({ path: relative, bytes: bytes.length, sha256: digest(bytes) }); }
    else throw new Error(`Unsupported export entry: ${relative}`);
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
try {
  if (process.argv.includes("--repo-vars")) {
    const result = execute("gh", ["variable", "list", "--repo", "JoshuaNguyen123/JoshuaNguyen123.github.io", "--json", "name,value"]);
    if (result.status !== 0) throw new Error("Could not read public repository variables. Authenticate gh or supply the public build configuration in the environment.");
    for (const { name, value } of JSON.parse(result.stdout)) {
      if (["NEXT_PUBLIC_CONTACT_API_URL", "NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "NEXT_PUBLIC_WEB3FORMS_KEY"].includes(name) && !env[name]) env[name] = value;
    }
  }
  receipt.configuration = validateReleaseConfiguration(env);
  receipt.commit = execute("git", ["rev-parse", "HEAD"]).stdout.trim();
  receipt.workingTreeDirty = Boolean(execute("git", ["status", "--porcelain"]).stdout.trim());
  receipt.source = await sourceIdentity();
  if (!env.npm_execpath) throw new Error("Run the candidate gate with npm run release:check.");
  await run("dependency-audit", [env.npm_execpath, "audit", "--omit=dev", "--audit-level=high", "--json"]);
  await run("lint", ["node_modules/eslint/bin/eslint.js", "."]);
  await run("tests", ["--test", "tests/*.test.mjs"]);
  await run("activity-audit", ["scripts/audit-activity.mjs", "--published-snapshot"]);
  await run("privacy", ["scripts/validate-activity.mjs", "public/data/activity.json"]);
  // Intentionally uses the validated snapshot; never recollects personal activity.
  await run("build", ["node_modules/next/dist/bin/next", "build"]);
  await writeFile(path.join(root, "out", ".nojekyll"), "");
  await run("export-smoke", ["scripts/smoke-export.mjs"]);
  await run("http-smoke", ["scripts/smoke-http.mjs"]);
  const html = await readFile(path.join(root, "out", "index.html"), "utf8");
  verifyContactExport(html, env);
  if (!html.includes('data-contact-configured="true"')) throw new Error("The built contact form is not configured.");
  const policy = readContentSecurityPolicy(html);
  const connectOrigins = policy.split(";").find((directive) => directive.trim().startsWith("connect-src "))?.trim().split(/\s+/).slice(1) ?? [];
  for (const name of ["NEXT_PUBLIC_CONTACT_API_URL", "NEXT_PUBLIC_ACTIVITY_FEED_URL", "NEXT_PUBLIC_BLOG_ADMIN_API_URL"]) {
    if (env[name] && !connectOrigins.includes(new URL(env[name]).origin)) throw new Error(`${name} is blocked by the exported CSP.`);
  }
  if ((await sourceIdentity()).sha256 !== receipt.source.sha256) throw new Error("Source changed during validation; make a fresh candidate.");
  const files = await inventory(path.join(root, "out"));
  await writeFile(path.join(destination, "files.json"), JSON.stringify(files, null, 2) + "\n");
  const archive = path.join(destination, "portfolio.tar.gz");
  const packed = execute("tar", ["-czf", archive, "-C", path.join(root, "out"), "."]);
  if (packed.status !== 0) throw new Error("Could not create the candidate archive.");
  receipt.artifact = { path: archive, sha256: digest(await readFile(archive)), files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), manifestSha256: digest(JSON.stringify(files)) };
  receipt.status = "passed";
  console.log(`Candidate passed. No deployment performed.\n${archive}`);
} catch (error) {
  receipt.status = "failed";
  receipt.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  await writeFile(path.join(destination, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`Receipt: ${path.join(destination, "receipt.json")}`);
}
