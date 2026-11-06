import { readFileSync } from "node:fs";
import path from "node:path";
import type { CSSProperties } from "react";
import styles from "./ArchitectureDiagram.module.css";

/**
 * A project's architecture, from its Mermaid source in content/architecture/.
 * scripts/render-architecture-diagrams.mjs renders each source to
 * public/projects/<slug>-architecture.svg; this server component inlines that
 * same file at build time, so the page and the full-size link never drift.
 *
 * Inlining lets the connections trace themselves in flow order as the reader
 * scrolls (ScrollSections writes --draw-progress on [data-scroll-draw]): each
 * edge and its label get an index, and solid edges a unit path length. Boxes
 * never move or hide; without JavaScript, or with reduced motion, it is fully
 * drawn.
 */
export function ArchitectureDiagram({ slug, label }: { slug: string; label: string }) {
  let svg: string;
  try {
    svg = readFileSync(path.join(process.cwd(), "public", "projects", `${slug}-architecture.svg`), "utf8");
  } catch {
    return null;
  }
  // Our own committed file, but it is inlined, so refuse anything executable.
  if (/<script|\son[a-z]+\s*=|(?:href|src)\s*=\s*"(?!#)/i.test(svg)) throw new Error(`${slug}-architecture.svg is not an inert diagram`);

  const order = new Map<string, number>();
  const drawn = svg
    .replace(/^<\?xml[^>]*>\s*/, "")
    // Keep a self-closing slash at the end: inline SVG in HTML only honours
    // "/>" as the very last characters, or every later edge nests inside.
    .replace(/<path\b([^>]*?\bclass="[^"]*\bflowchart-link\b[^"]*"[^>]*?)(\s*\/)?>/g, (tag: string, attributes: string, close = "") => {
      const id = /\bdata-id="([^"]+)"/.exec(attributes)?.[1] ?? /\bid="([^"]+)"/.exec(attributes)?.[1] ?? `edge-${order.size}`;
      const index = order.size;
      order.set(id, index);
      // Mermaid lists a default pattern class after the real one, so a dotted
      // edge also carries edge-pattern-solid; only undashed edges trace.
      const solid = !/\bedge-pattern-(?:dotted|dashed)\b/.test(attributes);
      const animation = `--i:${index};${solid ? "stroke-dasharray:1 1;stroke-dashoffset:calc(1 - var(--draw, 1));" : ""}`;
      const styled = /\sstyle="/.test(attributes)
        ? attributes.replace(/\sstyle="([^"]*)"/, (_match: string, existing: string) => ` style="${existing.replace(/;?$/, ";")}${animation}"`)
        : `${attributes} style="${animation}"`;
      return `<path${styled}${solid ? ' pathLength="1"' : ""}${close}>`;
    })
    .replace(/<g class="edgeLabel"([^>]*)>(\s*<g class="label" data-id="([^"]+)")/g, (tag: string, attributes: string, inner: string, id: string) => {
      const index = order.get(id);
      return index === undefined ? tag : `<g class="edgeLabel"${attributes} style="--i:${index}">${inner}`;
    });

  return (
    <div
      className={styles.diagram}
      role="img"
      aria-label={label}
      data-scroll-draw=""
      style={{ "--n": order.size } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: drawn }}
    />
  );
}
