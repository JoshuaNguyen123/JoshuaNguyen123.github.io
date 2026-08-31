import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { mergeHookLedger, readHookState } from "./live-activity-core.mjs";
import { exportLocalActivity } from "./local-exporter.mjs";

const output = path.resolve(process.env.ACTIVITY_OUTPUT ?? path.join("data", "local-activity.json"));
const retainedSnapshot = await exportLocalActivity({ previousFile: output });
const activityHome = process.env.ENGINEERING_ACTIVITY_HOME
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"), "EngineeringActivity");
let snapshot = retainedSnapshot;
try {
  const hookState = await readHookState(activityHome);
  snapshot = {
    ...retainedSnapshot,
    providers: mergeHookLedger(retainedSnapshot.providers, hookState, retainedSnapshot.generatedAt),
  };
} catch (error) {
  process.stderr.write(`Local hook aggregates were unavailable; exported retained-source aggregates only (${error.message}).\n`);
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(`Wrote privacy-safe local aggregates to ${output}`);
for (const [provider, value] of Object.entries(snapshot.providers)) {
  const details = Object.entries(value.metrics).map(([metricId, metric]) => {
    const total = metric.days.reduce((sum, day) => sum + day.value, 0);
    return `${metricId}=${metric.status === "available" ? total : "unavailable"}`;
  });
  console.log(`${provider}: ${details.join(", ")}`);
}
