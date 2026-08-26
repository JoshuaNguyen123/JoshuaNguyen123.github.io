import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_HOME = process.env.ENGINEERING_ACTIVITY_USER_HOME ?? homedir();
const ACTIVITY_HOME = process.env.ENGINEERING_ACTIVITY_HOME ?? path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"), "EngineeringActivity");
const RUNTIME_DIR = path.join(ACTIVITY_HOME, "runtime");
const RUNTIME = path.join(RUNTIME_DIR, "activity-hook-runtime.mjs");
const CURSOR_CONFIG = path.join(USER_HOME, ".cursor", "hooks.json");
const CLAUDE_CONFIG = path.join(USER_HOME, ".claude", "settings.json");
const OWNED_MARKER = RUNTIME.replaceAll("/", "\\");
const NODE_RUNTIME = process.execPath;

function fail(message) {
  throw new Error(`Local activity hooks: ${message}`);
}

async function loadJson(file, fallback) {
  if (!existsSync(file)) return structuredClone(fallback);
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(`${file} must contain a JSON object`);
    return parsed;
  } catch (error) {
    if (error.message.startsWith("Local activity hooks:")) throw error;
    fail(`${file} contains invalid JSON and was not changed`);
  }
}

async function atomicJson(file, value, { backup = true } = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  if (backup && existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(file, `${file}.activity-backup.${stamp}.json`);
  }
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

function command(kind) {
  return `"${NODE_RUNTIME.replaceAll('"', '\\"')}" "${RUNTIME}" ${kind}`;
}

function cursorEntry(kind) {
  return { command: command(kind), timeout: 10 };
}

function claudeHandler(kind) {
  return { type: "command", command: command(kind), timeout: 10 };
}

function commandOwned(value) {
  return typeof value?.command === "string" && value.command.replaceAll("/", "\\").includes(OWNED_MARKER);
}

function addUnique(array, entry, predicate = commandOwned) {
  const values = Array.isArray(array) ? array : [];
  if (!values.some(predicate)) values.push(entry);
  return values;
}

function installCursor(config) {
  if (config.version !== undefined && config.version !== 1) fail("Cursor hooks.json uses an unsupported schema version");
  config.version = 1;
  config.hooks = config.hooks && typeof config.hooks === "object" && !Array.isArray(config.hooks) ? config.hooks : {};
  config.hooks.sessionStart = addUnique(config.hooks.sessionStart, cursorEntry("cursor-session"));
  config.hooks.afterFileEdit = addUnique(config.hooks.afterFileEdit, cursorEntry("cursor-agent-edit"));
  config.hooks.afterTabFileEdit = addUnique(config.hooks.afterTabFileEdit, cursorEntry("cursor-tab-edit"));
  return config;
}

function installClaude(config) {
  config.hooks = config.hooks && typeof config.hooks === "object" && !Array.isArray(config.hooks) ? config.hooks : {};
  const mergeGroup = (event, matcher, kind) => {
    const groups = Array.isArray(config.hooks[event]) ? config.hooks[event] : [];
    let group = groups.find((candidate) => candidate && candidate.matcher === matcher && Array.isArray(candidate.hooks));
    if (!group) {
      group = { matcher, hooks: [] };
      groups.push(group);
    }
    group.hooks = addUnique(group.hooks, claudeHandler(kind));
    config.hooks[event] = groups;
  };
  mergeGroup("SessionStart", "", "claude-session");
  mergeGroup("PostToolUse", "Edit|Write|NotebookEdit", "claude-activity");
  // Claude Code deletes transcripts after cleanupPeriodDays (default 30), which erases the
  // activity history this pipeline is built on. Raise it, but never lower a user-set value.
  if (!Number.isInteger(config.cleanupPeriodDays) || config.cleanupPeriodDays < 3650) config.cleanupPeriodDays = 3650;
  return config;
}

function uninstallCursor(config) {
  if (!config.hooks || typeof config.hooks !== "object") return config;
  for (const event of ["sessionStart", "afterFileEdit", "afterTabFileEdit"]) {
    if (!Array.isArray(config.hooks[event])) continue;
    config.hooks[event] = config.hooks[event].filter((entry) => !commandOwned(entry));
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  return config;
}

function uninstallClaude(config) {
  if (!config.hooks || typeof config.hooks !== "object") return config;
  for (const event of ["SessionStart", "PostToolUse"]) {
    if (!Array.isArray(config.hooks[event])) continue;
    config.hooks[event] = config.hooks[event].map((group) => ({ ...group, hooks: Array.isArray(group.hooks) ? group.hooks.filter((entry) => !commandOwned(entry)) : group.hooks }))
      .filter((group) => !Array.isArray(group.hooks) || group.hooks.length);
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  if (!Object.keys(config.hooks).length) delete config.hooks;
  return config;
}

async function ensureRuntime() {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await copyFile(path.join(ROOT, "scripts", "activity-hook-runtime.mjs"), RUNTIME);
  await copyFile(path.join(ROOT, "scripts", "local-hook-core.mjs"), path.join(RUNTIME_DIR, "local-hook-core.mjs"));
  const configFile = path.join(ACTIVITY_HOME, "config.json");
  let config;
  if (existsSync(configFile)) {
    config = await loadJson(configFile, {});
    if (typeof config.hookSecret !== "string" || config.hookSecret.length < 32 || Number.isNaN(Date.parse(config.installedAt))) fail("existing local hook configuration is invalid");
  } else {
    config = { hookSecret: randomBytes(32).toString("base64url"), installedAt: new Date().toISOString() };
    await atomicJson(configFile, config, { backup: false });
  }
  await mkdir(path.join(ACTIVITY_HOME, "spool"), { recursive: true });
}

function version(commandName) {
  const result = process.platform === "win32" && commandName === "cursor"
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "cursor.cmd --version"], { encoding: "utf8", windowsHide: true })
    : spawnSync(commandName, ["--version"], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
}

async function status() {
  const cursor = await loadJson(CURSOR_CONFIG, { version: 1, hooks: {} });
  const claude = await loadJson(CLAUDE_CONFIG, {});
  const cursorInstalled = Object.values(cursor.hooks ?? {}).some((entries) => Array.isArray(entries) && entries.some(commandOwned));
  const claudeInstalled = Object.values(claude.hooks ?? {}).some((groups) => Array.isArray(groups) && groups.some((group) => Array.isArray(group.hooks) && group.hooks.some(commandOwned)));
  return { activityHome: ACTIVITY_HOME, cursorVersion: version("cursor"), claudeVersion: version("claude"), runtimeInstalled: existsSync(RUNTIME), cursorInstalled, claudeInstalled };
}

export async function manageHooks(action) {
  if (action === "preflight") {
    const current = await status();
    if (!current.cursorVersion) fail("Cursor CLI was not found");
    if (!current.claudeVersion) fail("Claude Code CLI was not found");
    await loadJson(CURSOR_CONFIG, { version: 1, hooks: {} });
    await loadJson(CLAUDE_CONFIG, {});
    return current;
  }
  if (action === "status") return status();
  if (action === "install") {
    await ensureRuntime();
    await atomicJson(CURSOR_CONFIG, installCursor(await loadJson(CURSOR_CONFIG, { version: 1, hooks: {} })));
    await atomicJson(CLAUDE_CONFIG, installClaude(await loadJson(CLAUDE_CONFIG, {})));
    return status();
  }
  if (action === "uninstall") {
    if (existsSync(CURSOR_CONFIG)) await atomicJson(CURSOR_CONFIG, uninstallCursor(await loadJson(CURSOR_CONFIG, {})));
    if (existsSync(CLAUDE_CONFIG)) await atomicJson(CLAUDE_CONFIG, uninstallClaude(await loadJson(CLAUDE_CONFIG, {})));
    return status();
  }
  fail("action must be preflight, install, status, or uninstall");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await manageHooks(process.argv[2] ?? "status");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
