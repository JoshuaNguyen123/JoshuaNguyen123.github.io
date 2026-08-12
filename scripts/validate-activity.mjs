import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateSnapshot } from "./activity-core.mjs";

const file = path.resolve(process.argv[2] ?? path.join("public", "data", "activity.json"));
const snapshot = JSON.parse(await readFile(file, "utf8"));
validateSnapshot(snapshot);
console.log(`Privacy validation passed: ${file}`);
