/** Fraction of the viewport height where an entry counts as being read. */
export const READING_LINE = 0.4;

/**
 * How far an element has come into view, 0 to 1: zero as its top enters the
 * bottom tenth of the viewport, one once all of it sits above the lower fifth.
 * Diagrams use it to trace their connections while they are on screen.
 */
export function drawProgress(rect: DOMRect, viewport: number): number {
  const progress = (viewport * 0.9 - rect.top) / (rect.height + viewport * 0.2);
  return Math.min(1, Math.max(0, progress));
}
