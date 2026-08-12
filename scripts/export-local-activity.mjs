import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportLocalActivity } from "./local-exporter.mjs";

const output = path.resolve(process.env.ACTIVITY_OUTPUT ?? path.join("data", "local-activity.json"));
const snapshot = await exportLocalActivity();
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const counts = Object.fromEntries(Object.entries(snapshot.providers).map(([provider, value]) => [provider, value.days.reduce((sum, day) => sum + day.value, 0)]));
console.log(`Wrote privacy-safe local aggregates to ${output}`);
console.log(`Observed counts: Codex ${counts.codex}, Cursor ${counts.cursor}, Claude Code ${counts["claude-code"]}`);
