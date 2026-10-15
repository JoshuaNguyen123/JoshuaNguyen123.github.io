// Writes public/projects/<slug>-architecture.svg from the specs in lib/architecture.ts,
// so the static files (homepage, full-size link) match the inline case-study diagrams.
// Usage: node scripts/draw-architecture-diagrams.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { diagrams, drawingToSvg, layoutDiagram } from "../lib/architecture.ts";

const root = process.cwd();
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
let collisions = 0;
for (const [slug, spec] of Object.entries(diagrams)) {
  const drawing = layoutDiagram(spec);
  // An edge label must sit in open space, never under a box.
  for (const edge of drawing.edges) {
    if (!edge.label) continue;
    const box = { x: edge.label.x - edge.label.w / 2, y: edge.label.y - 17, w: edge.label.w, h: 34 };
    for (const node of drawing.nodes) {
      if (overlaps(box, node)) {
        collisions += 1;
        console.error(`${slug}: label "${edge.label.text}" overlaps ${node.title}`);
      }
    }
  }
  const file = path.join(root, "public", "projects", `${slug}-architecture.svg`);
  await writeFile(file, drawingToSvg(drawing, slug));
  console.log(`wrote ${path.relative(root, file)}`);
}
if (collisions) process.exitCode = 1;
