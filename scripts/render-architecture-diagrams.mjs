// Renders each content/architecture/<slug>.mmd to public/projects/<slug>-architecture.svg,
// styled by content/architecture/mermaid.config.json. Mermaid measures text in a
// real browser, so this runs locally (npx fetches the pinned mermaid-cli and its
// headless Chrome on first use) and the SVGs are committed. The build only reads
// them: the case-study page inlines the same file the full-size link opens.
// Usage: node scripts/render-architecture-diagrams.mjs [slug ...]
import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SOURCE_DIR, SOURCE_STAMP, sourceHash } from "./architecture-source.mjs";

const MERMAID_CLI = "@mermaid-js/mermaid-cli@11.17.0";
const OUTPUT_DIR = "public/projects";
const PAPER = "#f7f8f5";

const requested = process.argv.slice(2);
const slugs = requested.length
  ? requested
  : (await readdir(SOURCE_DIR)).filter((file) => file.endsWith(".mmd")).map((file) => file.slice(0, -4)).sort();

let failures = 0;
for (const slug of slugs) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Unsafe diagram slug: ${slug}`);
  const input = `${SOURCE_DIR}/${slug}.mmd`;
  const output = `${OUTPUT_DIR}/${slug}-architecture.svg`;
  const source = await readFile(input, "utf8");
  if (!/^\s*accTitle:/m.test(source) || !/^\s*accDescr:/m.test(source)) {
    console.error(`${input}: needs accTitle and accDescr, which become the SVG's title and description`);
    failures += 1;
    continue;
  }
  const args = ["-q", "-i", input, "-o", output, "-c", `${SOURCE_DIR}/mermaid.config.json`, "-b", PAPER, "-I", `${slug}-architecture`];
  // Through `npm run architecture:render`, run npm's own CLI with node so no
  // shell is involved. Run directly, fall back to npx (a .cmd shim on Windows,
  // which needs a shell; every argument above is a fixed, validated literal).
  const result = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, "exec", "--yes", `--package=${MERMAID_CLI}`, "--", "mmdc", ...args], { stdio: "inherit" })
    : spawnSync("npx", ["-y", MERMAID_CLI, ...args], { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`${input}: mermaid-cli exited with ${result.status}`);
    failures += 1;
    continue;
  }
  // The file is inlined into the page, so it must stay inert: no scripts, event
  // handlers, or external references.
  const svg = await readFile(output, "utf8");
  const unsafe = [/<script/i, /\son[a-z]+\s*=/i, /(?:href|src)\s*=\s*"(?!#)/i].find((pattern) => pattern.test(svg));
  if (unsafe) {
    console.error(`${output}: rendered SVG contains ${unsafe}`);
    failures += 1;
    continue;
  }
  // Stamp the inputs so tests/architecture-diagrams.test.mjs can tell when a
  // source or the theme changed without the SVG being rendered again.
  const stamped = `<!-- ${SOURCE_STAMP}${await sourceHash(slug)} -->\n${svg.trim()}\n`;
  await writeFile(output, stamped);
  console.log(`wrote ${path.normalize(output)}`);
}
if (failures) process.exitCode = 1;
