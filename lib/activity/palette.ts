import type { ActivityChannel } from "./types";

export const providerPalettes: Record<ActivityChannel, readonly [string, string, string, string, string, string]> = {
  // Every ramp starts from the same soft green-gray zero and steps toward ink, so the
  // heatmaps read as part of the page rather than a separate dark widget.
  // Provider identity comes from the labelled marks next to each heading.
  "build-index": ["#e5ece7", "#bfcec6", "#94ac9e", "#6b8a79", "#446a58", "#234b3b"],
  github: ["#e5ece7", "#bcc6bc", "#93a697", "#6a8670", "#3f6b52", "#1f3d2c"],
  codex: ["#e5ece7", "#bcc2c9", "#91a0ad", "#667d90", "#3f5a73", "#203344"],
  cursor: ["#e5ece7", "#cbbfc9", "#ad99ac", "#8c728c", "#684d6a", "#3e2a40"],
  "claude-code": ["#e5ece7", "#d4c0b2", "#bf9b86", "#a4775f", "#7f5440", "#4a2e21"],
};
