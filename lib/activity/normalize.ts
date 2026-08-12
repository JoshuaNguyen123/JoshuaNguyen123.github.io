import type { ActivityLevel } from "./types";

function quantile(sorted: number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function normalizeActivityLevels(values: number[]): ActivityLevel[] {
  const activeValues = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (activeValues.length === 0) return values.map(() => 0);

  const uniqueValues = new Set(activeValues);
  if (uniqueValues.size === 1) {
    return values.map((value) => (value > 0 ? 3 : 0));
  }

  const thresholds = [
    quantile(activeValues, 0.25),
    quantile(activeValues, 0.5),
    quantile(activeValues, 0.75),
    quantile(activeValues, 0.9),
  ];

  return values.map((value): ActivityLevel => {
    if (value <= 0) return 0;
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    if (value <= thresholds[3]) return 4;
    return 5;
  });
}
