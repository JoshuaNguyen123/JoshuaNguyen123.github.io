import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const types = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".woff2": "font/woff2" };

/** A plain static host: no rewrites, segment aliases, or development fallback. */
export function createStaticPreview(directory = "out") {
  const root = path.resolve(directory);
  return createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405, { Allow: "GET, HEAD" }).end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let file = path.resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      let info = await stat(file);
      if (info.isDirectory()) {
        if (!pathname.endsWith("/")) { response.writeHead(308, { Location: pathname + "/" }).end(); return; }
        file = path.join(file, "index.html"); info = await stat(file);
      }
      if (!info.isFile()) throw new Error("Not a file");
      response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Content-Length": info.size });
      if (request.method === "HEAD") response.end();
      else createReadStream(file).on("error", () => response.destroy()).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      if (request.method === "HEAD") response.end();
      else createReadStream(path.join(root, "404.html")).on("error", () => response.end("Not found")).pipe(response);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4183);
  const server = createStaticPreview(process.argv[2] ?? "out");
  server.listen(port, "127.0.0.1", () => console.log(`Static candidate preview: http://127.0.0.1:${port}/`));
}
