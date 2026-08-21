import type { ActivityChannel } from "./types";

export const providerPalettes: Record<ActivityChannel, readonly [string, string, string, string, string, string]> = {
  // Every ramp shares a dark zero and uses pronounced lightness steps, so
  // intensity remains readable when hue perception is reduced or absent.
  "build-index": ["#182128", "#183e4c", "#205c70", "#2d7c95", "#51a6be", "#8fd7e8"],
  github: ["#182128", "#153e36", "#1f5e4f", "#2c806a", "#55a989", "#96d5b8"],
  codex: ["#182128", "#173b58", "#225b82", "#317bab", "#5ba3cf", "#9acde5"],
  cursor: ["#182128", "#3d2f47", "#5d4668", "#80618a", "#aa87b1", "#d9bdd8"],
  "claude-code": ["#182128", "#4b3028", "#71463a", "#9a604b", "#c48668", "#e7b49b"],
};
