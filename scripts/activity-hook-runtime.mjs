import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reduceHookPayload, readHookSecret, writeSpoolEvent } from "./local-hook-core.mjs";

async function stdinJson() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 10 * 1024 * 1024) throw new Error("Hook payload exceeds safety limit");
  }
  return JSON.parse(input || "{}");
}

export async function runHook(kind, {
  activityHome = process.env.ENGINEERING_ACTIVITY_HOME ?? path.join(process.env.LOCALAPPDATA ?? "", "EngineeringActivity"),
  payload,
  now,
} = {}) {
  const secret = await readHookSecret(activityHome);
  const aggregate = reduceHookPayload(kind, payload ?? await stdinJson(), secret, now);
  if (aggregate) await writeSpoolEvent(activityHome, aggregate);
  return aggregate;
}

async function preflight(activityHome) {
  const secret = await readHookSecret(activityHome);
  const runtime = await readFile(fileURLToPath(import.meta.url), "utf8");
  if (!runtime.includes("runHook") || secret.length < 32) throw new Error("Hook runtime preflight failed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kind = process.argv[2];
  const activityHome = process.env.ENGINEERING_ACTIVITY_HOME ?? path.join(process.env.LOCALAPPDATA ?? "", "EngineeringActivity");
  try {
    if (kind === "--preflight") await preflight(activityHome);
    else await runHook(kind, { activityHome });
    process.stdout.write("{}\n");
  } catch {
    process.stderr.write("Local activity hook could not record this event.\n");
    process.stdout.write("{}\n");
  }
}
