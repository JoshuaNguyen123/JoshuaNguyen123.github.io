import { addDays } from "./calendar.ts";

export function getLongestStreak(activeDates: string[]): number {
  const dates = [...new Set(activeDates)].sort();
  let longest = 0;
  let current = 0;
  let previous: string | undefined;

  for (const date of dates) {
    current = previous && addDays(previous, 1) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

export function getCurrentStreak(
  activeDates: string[],
  endDate: string,
): number {
  const dates = new Set(activeDates);
  let cursor = endDate;
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
