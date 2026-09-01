import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const outRoot = path.resolve("out");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(outRoot, relative);
    if (file !== outRoot && !file.startsWith(`${outRoot}${path.sep}`)) throw new Error("Invalid path");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Smoke server failed to bind");
  const origin = `http://127.0.0.1:${address.port}`;
  const [rootResponse, dataResponse] = await Promise.all([fetch(`${origin}/`), fetch(`${origin}/data/activity.json`)]);
  if (!rootResponse.ok || !dataResponse.ok) throw new Error("Static export did not serve successfully");
  const [html, activity] = await Promise.all([rootResponse.text(), dataResponse.json()]);
  if (!html.includes("Codex session-days") || !html.includes("Observed activity") || html.includes("Cursor applied AI line changes")) {
    throw new Error("Served dashboard is missing reconciled activity labels");
  }
  if (activity.schemaVersion !== 6 || activity.privacyVersion !== "aggregate-v6" || !activity.providers?.codex?.metrics?.repositoryEvidence || !activity.providers?.cursor?.metrics?.activeSessions || !activity.providers?.cursor?.metrics?.usagePresence || !activity.providers?.cursor?.metrics?.appliedLineChanges || !activity.providers?.["claude-code"]?.metrics?.repositoryEvidence) {
    throw new Error("Served activity snapshot has an unexpected reconciliation state");
  }
  console.log("Local production HTTP smoke test passed");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
