import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportLocalActivity } from "./local-exporter.mjs";

const output = path.resolve(process.env.ACTIVITY_OUTPUT ?? path.join("data", "local-activity.json"));
const snapshot = await exportLocalActivity();
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
