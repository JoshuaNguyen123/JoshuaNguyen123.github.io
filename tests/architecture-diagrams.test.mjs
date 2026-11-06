import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { projects } from "../content/projects.ts";
import { SOURCE_DIR, SOURCE_STAMP, sourceHash } from "../scripts/architecture-source.mjs";

const svgFor = (slug) => readFile(`public/projects/${slug}-architecture.svg`, "utf8");

test("every project has a Mermaid source with an accessible title and description", async () => {
  const sources = (await readdir(SOURCE_DIR)).filter((file) => file.endsWith(".mmd")).map((file) => file.slice(0, -4)).sort();
  assert.deepEqual(sources, projects.map(({ slug }) => slug).sort());
  for (const { slug, image } of projects) {
    assert.equal(image, `/projects/${slug}-architecture.svg`);
    const source = await readFile(`${SOURCE_DIR}/${slug}.mmd`, "utf8");
    assert.match(source, /^flowchart (?:LR|TB|TD|RL|BT)\b/, `${slug} is a flowchart`);
    assert.match(source, /^\s*accTitle: .+architecture$/m, `${slug} names itself`);
    assert.match(source, /^\s*accDescr: .{80,}$/m, `${slug} describes the flow in words`);
  }
});

test("each rendered SVG is current with its source and theme", async () => {
  for (const { slug } of projects) {
    const svg = await svgFor(slug);
    const stamp = new RegExp(`^<!-- ${SOURCE_STAMP}([0-9a-f]{64}) -->`).exec(svg)?.[1];
    assert.equal(stamp, await sourceHash(slug), `${slug}: run npm run architecture:render`);
    assert.match(svg, new RegExp(`<svg[^>]*\\bid="${slug}-architecture"`), `${slug}: scoped SVG id`);
  }
});

test("rendered diagrams are inert, because the case study inlines them", async () => {
  for (const { slug } of projects) {
    const svg = await svgFor(slug);
    assert.doesNotMatch(svg, /<script/i, slug);
    assert.doesNotMatch(svg, /\son[a-z]+\s*=/i, slug);
    assert.doesNotMatch(svg, /(?:href|src)\s*=\s*"(?!#)/i, slug);
    assert.match(svg, /<title[^>]*>[^<]+architecture<\/title>/, `${slug}: accessible title`);
  }
});
