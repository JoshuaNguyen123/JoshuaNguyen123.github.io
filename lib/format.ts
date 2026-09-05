const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "2026-08-21" -> "August 21, 2026". Noon UTC keeps the calendar date stable in every zone. */
export function formatDate(value: string): string {
  return longDate.format(new Date(`${value}T12:00:00Z`));
}