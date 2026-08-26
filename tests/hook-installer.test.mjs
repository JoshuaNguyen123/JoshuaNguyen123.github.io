import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const installer = fileURLToPath(new URL("../scripts/hook-installer.mjs", import.meta.url));

function run(action, profile, activityHome) {
  return spawnSync(process.execPath, [installer, action], {
    encoding: "utf8",
    env: { ...process.env, ENGINEERING_ACTIVITY_USER_HOME: profile, ENGINEERING_ACTIVITY_HOME: activityHome },
    windowsHide: true,
  });
}

test("hook installer merges idempotently, backs up, and removes only owned hooks", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "hook-installer-"));
  context.after(async () => { await rm(root, { recursive: true, force: true }); });
  const profile = path.join(root, "profile");
  const activityHome = path.join(root, "activity");
  await mkdir(path.join(profile, ".claude"), { recursive: true });
  await mkdir(path.join(profile, ".cursor"), { recursive: true });
  await writeFile(path.join(profile, ".claude", "settings.json"), JSON.stringify({ theme: "dark", hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: "existing-command" }] }] } }));
  await writeFile(path.join(profile, ".cursor", "hooks.json"), JSON.stringify({ version: 1, hooks: { sessionStart: [{ command: "existing-cursor-command" }] } }));
  assert.equal(run("install", profile, activityHome).status, 0);
  assert.equal(run("install", profile, activityHome).status, 0);
  const claude = JSON.parse(await readFile(path.join(profile, ".claude", "settings.json"), "utf8"));
  const cursor = JSON.parse(await readFile(path.join(profile, ".cursor", "hooks.json"), "utf8"));
  assert.equal(claude.theme, "dark");
  assert.equal(claude.hooks.SessionStart[0].hooks.filter((entry) => entry.command === "existing-command").length, 1);
  assert.equal(claude.hooks.SessionStart[0].hooks.filter((entry) => /activity-hook-runtime/i.test(entry.command)).length, 1);
  assert.equal(cursor.hooks.sessionStart.filter((entry) => entry.command === "existing-cursor-command").length, 1);
  assert.equal(cursor.hooks.sessionStart.filter((entry) => /activity-hook-runtime/i.test(entry.command)).length, 1);
  const installedCommand = cursor.hooks.sessionStart.find((entry) => /activity-hook-runtime/i.test(entry.command)).command;
  assert.ok(installedCommand.startsWith(`"${process.execPath}"`), "installed hooks must pin the current Node runtime by absolute path");
  assert.equal(run("uninstall", profile, activityHome).status, 0);
  const after = JSON.parse(await readFile(path.join(profile, ".claude", "settings.json"), "utf8"));
  assert.equal(after.theme, "dark");
  assert.equal(after.hooks.SessionStart[0].hooks[0].command, "existing-command");
});

test("hook installer fails closed on malformed settings", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "hook-invalid-"));
  context.after(async () => { await rm(root, { recursive: true, force: true }); });
  const profile = path.join(root, "profile");
  await mkdir(path.join(profile, ".claude"), { recursive: true });
  await writeFile(path.join(profile, ".claude", "settings.json"), "{not json");
  const result = run("install", profile, path.join(root, "activity"));
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(path.join(profile, ".claude", "settings.json"), "utf8"), "{not json");
});
