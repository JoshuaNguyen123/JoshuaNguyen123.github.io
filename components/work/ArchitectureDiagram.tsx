import { ACCENT, CANVAS, INK, MONO, MUTED, PAPER, RULE, SANS, diagrams, layoutDiagram, nodeText, sizes } from "@/lib/architecture";
import type { CSSProperties } from "react";
import styles from "./ArchitectureDiagram.module.css";

/**
 * A project's architecture, drawn inline from lib/architecture.ts so its
 * connections can trace themselves in flow order as the reader scrolls
 * (ScrollSections writes --draw-progress on [data-scroll-draw]). Boxes never
 * move or hide; without JavaScript, or with reduced motion, it is fully drawn.
 */
export function ArchitectureDiagram({ slug, label }: { slug: string; label: string }) {
  const spec = diagrams[slug];
  if (!spec) return null;
  const drawing = layoutDiagram(spec);

  return (
    <svg
      className={styles.diagram}
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      role="img"
      aria-label={label}
      data-scroll-draw=""
      style={{ "--n": drawing.edges.length } as CSSProperties}
    >
      <desc>{drawing.description}</desc>
      <rect width={CANVAS.width} height={CANVAS.height} fill={PAPER} />
      {drawing.boundaries.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={RULE} strokeWidth={2} strokeDasharray="8 8" />
          <text className={styles.mono} x={b.x + 22} y={b.y + 36} fill={MUTED} fontFamily={MONO} fontSize={sizes.label}>{b.label}</text>
        </g>
      ))}
      {drawing.edges.map((e, index) => {
        const color = e.dashed ? MUTED : e.main ? ACCENT : INK;
        return (
          <g key={index} className={styles.edge} style={{ "--i": index } as CSSProperties}>
            <path
              className={e.dashed ? styles.dashed : styles.line}
              d={e.d}
              fill="none"
              stroke={color}
              strokeWidth={e.main ? 3 : 2}
              strokeDasharray={e.dashed ? "6 7" : undefined}
              pathLength={e.dashed ? undefined : 1}
            />
            <path className={styles.head} d={e.arrow} fill={color} />
            {e.label ? (
              <g className={styles.head}>
                <rect x={e.label.x - e.label.w / 2} y={e.label.y - 17} width={e.label.w} height={34} fill={PAPER} />
                <text className={styles.mono} x={e.label.x} y={e.label.y + 6} textAnchor="middle" fill={MUTED} fontFamily={MONO} fontSize={sizes.label}>{e.label.text}</text>
              </g>
            ) : null}
          </g>
        );
      })}
      {drawing.nodes.map((n) => {
        const text = nodeText(n);
        return (
          <g key={`${n.title}-${n.x}-${n.y}`}>
            <rect
              x={n.x} y={n.y} width={n.w} height={n.h} fill={PAPER}
              stroke={n.variant === "key" ? ACCENT : n.variant === "side" ? RULE : INK}
              strokeWidth={n.variant === "key" ? 3 : 2}
              strokeDasharray={n.variant === "side" ? "8 6" : undefined}
            />
            <text className={styles.sans} x={text.title.x} y={text.title.y} fill={n.variant === "side" ? MUTED : INK} fontFamily={SANS} fontSize={sizes.title} fontWeight={500}>{n.title}</text>
            {text.sub.map((s, index) => (
              <text key={index} className={styles.mono} x={s.x} y={s.y} fill={MUTED} fontFamily={MONO} fontSize={sizes.sub}>{s.line}</text>
            ))}
          </g>
        );
      })}
      {drawing.notes.map((note) => note.lines.map((line, index) => (
        <text key={`${note.x}-${note.y}-${index}`} className={styles.mono} x={note.x} y={note.y + index * 30} fill={MUTED} fontFamily={MONO} fontSize={sizes.sub}>{line}</text>
      )))}
    </svg>
  );
}
