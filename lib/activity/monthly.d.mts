import type { MetricActivitySnapshot } from "./types";
export interface ActivityMonth {
  key: string; start: string; end: string; elapsedDays: number;
  coveredDays: number; activeDays: number | null; partialMonth: boolean; label: string;
}
export function monthlyActivity(metric: MetricActivitySnapshot, startDate: string, endDate: string): ActivityMonth[];
