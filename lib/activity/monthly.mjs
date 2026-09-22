// Count days with evidence, not sessions or contributions. Missing dates stay
// missing, including gaps inside a provider's reported coverage envelope.
export function monthlyActivity(metric, startDate, endDate) {
  const first = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
  const months = [];
  for (let date = first; date.toISOString().slice(0, 10) <= endDate; date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))) {
    const key = date.toISOString().slice(0, 7);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const start = key + "-01" > startDate ? key + "-01" : startDate;
    const end = last < endDate ? last : endDate;
    const elapsedDays = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    const points = new Map();
    if (metric.status !== "unavailable" && metric.coverage.start && metric.coverage.end) {
      for (const point of metric.days) {
        if (point.date >= start && point.date <= end && point.date >= metric.coverage.start && point.date <= metric.coverage.end) {
          points.set(point.date, Math.max(points.get(point.date) ?? 0, point.value));
        }
      }
    }
    months.push({ key, start, end, elapsedDays, coveredDays: points.size,
      activeDays: points.size ? [...points.values()].filter(value => value > 0).length : null,
      partialMonth: end < last,
      label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    });
  }
  return months;
}
