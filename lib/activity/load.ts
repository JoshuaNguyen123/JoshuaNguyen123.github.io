import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import type { ActivitySnapshot } from "@/lib/activity/types";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Reads the bundled, privacy-validated snapshot at build time. Shared by the
 *  homepage and the activity detail route so both render the same source. */
export function loadActivitySnapshot(): ActivitySnapshot {
  const snapshotPath = path.join(process.cwd(), "public", "data", "activity.json");
  const snapshot = parseActivitySnapshot(JSON.parse(readFileSync(snapshotPath, "utf8")));
  if (!snapshot) throw new Error("Bundled activity snapshot failed runtime validation");
  return snapshot;
}
