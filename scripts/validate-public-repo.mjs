import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const forbiddenBasenames = new Set(["agents.md", "claude.md"]);
const allowedEnvironmentExamples = new Set([".env.example", ".env.live.example"]);
const forbiddenCredentialExtensions = new Set([".key", ".p12", ".pfx", ".jks", ".keystore"]);
const credentialDetectors = [
  ["GitHub token", /(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{36,})/],
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI API key", /sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Slack token", /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ["Stripe live secret", /sk_live_[0-9A-Za-z]{16,}/],
  ["Supabase secret", /sb_secret_[0-9A-Za-z_-]{16,}/],
  ["npm access token", /npm_[A-Za-z0-9]{36}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

function normalizeRepositoryPath(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isBinary(contents) {
  return contents.subarray(0, 8_192).includes(0);
}

export function validatePublicFiles(files) {
  const violations = [];
  for (const file of files) {
    const repositoryPath = normalizeRepositoryPath(file.path);
    const basename = path.posix.basename(repositoryPath).toLowerCase();
    const extension = path.posix.extname(basename);

    if (forbiddenBasenames.has(basename)) violations.push({ path: repositoryPath, reason: "local agent instruction file is tracked" });
    if (basename.startsWith(".env") && !allowedEnvironmentExamples.has(basename)) violations.push({ path: repositoryPath, reason: "non-example environment file is tracked" });
    if (extension === ".pem" || forbiddenCredentialExtensions.has(extension)) violations.push({ path: repositoryPath, reason: "credential or private-key container is tracked" });
    if (!file.contents || isBinary(file.contents)) continue;

    const contents = file.contents.toString("utf8");
    for (const [label, pattern] of credentialDetectors) {
      if (pattern.test(contents)) violations.push({ path: repositoryPath, reason: `${label} pattern detected` });
    }
  }
  return violations;
}

export async function validateTrackedRepository(root = process.cwd()) {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (listed.status !== 0) throw new Error("Public repository safety check could not enumerate tracked files");
  const paths = listed.stdout.split("\0").filter(Boolean);
  const files = await Promise.all(paths.map(async (file) => ({ path: file, contents: await readFile(path.join(root, file)) })));
  return { paths, violations: validatePublicFiles(files) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { paths, violations } = await validateTrackedRepository();
    if (violations.length) {
      process.stderr.write(`Public repository safety check failed:\n${violations.map(({ path: file, reason }) => `- ${file}: ${reason}`).join("\n")}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`Public repository safety check passed for ${paths.length} tracked files.\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
