// Shared by the diagram renderer and its test: one hash of everything that
// shapes a rendered architecture SVG (its Mermaid source and the site theme).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const SOURCE_DIR = "content/architecture";
export const SOURCE_STAMP = "mermaid-source-sha256:";

const normalize = (text) => text.replace(/\r\n/g, "\n");

export async function sourceHash(slug, root = process.cwd()) {
  const [source, config] = await Promise.all([
    readFile(path.join(root, SOURCE_DIR, `${slug}.mmd`), "utf8"),
    readFile(path.join(root, SOURCE_DIR, "mermaid.config.json"), "utf8"),
  ]);
  return createHash("sha256").update(normalize(source)).update("\0").update(normalize(config)).digest("hex");
}
