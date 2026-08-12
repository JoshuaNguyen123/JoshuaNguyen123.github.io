import type { ActivityChannel } from "./types";

export const providerPalettes: Record<ActivityChannel, readonly [string, string, string, string, string, string]> = {
  "build-index": ["#202a34", "#16313f", "#1c5067", "#24708f", "#3d94b7", "#72c7e8"],
  github: ["#202a34", "#17352f", "#1c5144", "#246c59", "#338b70", "#5cbd98"],
  codex: ["#202a34", "#1b3045", "#234a6a", "#2c6590", "#3a82b4", "#6daed8"],
  cursor: ["#202a34", "#38283a", "#543957", "#714b74", "#965f98", "#ca8bcc"],
  "claude-code": ["#202a34", "#442924", "#65382f", "#89483a", "#b75d47", "#e78d6c"],
};
