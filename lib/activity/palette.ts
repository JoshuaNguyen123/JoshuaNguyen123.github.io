import type { ActivityChannel } from "./types";

export const providerPalettes: Record<ActivityChannel, readonly [string, string, string, string, string, string]> = {
  // Every ramp starts from the same cream zero and steps toward ink, so the
  // heatmaps read as part of the page rather than a separate dark widget.
  // Provider identity comes from the labelled marks next to each heading.
  "build-index": ["#e1ded5", "#c2bfb5", "#9d9c94", "#72767a", "#3f464d", "#101419"],
  github: ["#e1ded5", "#bcc6bc", "#93a697", "#6a8670", "#3f6b52", "#1f3d2c"],
  codex: ["#e1ded5", "#bcc2c9", "#91a0ad", "#667d90", "#3f5a73", "#203344"],
  cursor: ["#e1ded5", "#cbbfc9", "#ad99ac", "#8c728c", "#684d6a", "#3e2a40"],
  "claude-code": ["#e1ded5", "#d4c0b2", "#bf9b86", "#a4775f", "#7f5440", "#4a2e21"],
};
