export interface CalendarCell {
  date: string | null;
  inRange: boolean;
}

export interface CalendarWeek {
  cells: CalendarCell[];
  monthLabel?: string;
}

const DAY_MS = 86_400_000;

export function parseISODate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number): string {
  return toISODate(new Date(parseISODate(date).getTime() + amount * DAY_MS));
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const start = parseISODate(startDate).getTime();
  const end = parseISODate(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Invalid activity date range");
  }

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    dates.push(toISODate(new Date(cursor)));
  }
  return dates;
}

export function buildCalendarWeeks(
  startDate: string,
  endDate: string,
): CalendarWeek[] {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (start > end) throw new Error("Invalid activity date range");

  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const weeks: CalendarWeek[] = [];
  let previousMonth = -1;
  for (
    let weekStart = gridStart.getTime();
    weekStart <= gridEnd.getTime();
    weekStart += 7 * DAY_MS
  ) {
    const cells = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = toISODate(new Date(weekStart + dayIndex * DAY_MS));
      return {
        date,
        inRange: date >= startDate && date <= endDate,
      };
    });

    const visibleDates = cells.filter((cell) => cell.inRange && cell.date);
    const representative = visibleDates[0]?.date
      ? parseISODate(visibleDates[0].date)
      : new Date(weekStart);
    const month = representative.getUTCMonth();
    const monthLabel =
      month !== previousMonth
        ? representative.toLocaleDateString("en-US", {
            month: "short",
            timeZone: "UTC",
          })
        : undefined;
    previousMonth = month;
    weeks.push({ cells, monthLabel });
  }

  return weeks;
}

export function daysBetween(startDate: string, endDate: string): number {
  return Math.floor(
    (parseISODate(endDate).getTime() - parseISODate(startDate).getTime()) /
      DAY_MS,
  );
}
