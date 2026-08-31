// Single source of truth for the eight summary numbers shown on both the
// dashboard (ActivitySummary) and the /activity methodology page
// (ActivityDefinitions). Both surfaces must render the same cards, in the same
// order, with the same labels and short notes, so the two pages can never
// drift apart again. The long explanations feed the per-number glossary.

export type SummaryCardId =
  | "contributions"
  | "codexSessionDays"
  | "cursorSessionDays"
  | "claudeSessionDays"
  | "observedBuildDays"
  | "cursorObservedDays"
  | "currentStreak"
  | "longestStreak";

export const summaryCardOrder: SummaryCardId[] = [
  "contributions",
  "codexSessionDays",
  "cursorSessionDays",
  "claudeSessionDays",
  "observedBuildDays",
  "cursorObservedDays",
  "currentStreak",
  "longestStreak",
];

export const summaryCardLabels: Record<SummaryCardId, string> = {
  contributions: "GitHub contributions",
  codexSessionDays: "Codex session-days",
  cursorSessionDays: "Cursor session-days",
  claudeSessionDays: "Claude Code session-days",
  observedBuildDays: "Observed build days",
  cursorObservedDays: "Cursor observed days",
  currentStreak: "Current streak",
  longestStreak: "Longest streak",
};

// Short one-line notes rendered under the number on both surfaces. Cards whose
// note depends on live data (active-day counts) build it with
// activeDaysNote / cursorDaysNote below instead.
export const summaryCardNotes: Partial<Record<SummaryCardId, string>> = {
  observedBuildDays: "days when at least one covered tool recorded activity",
  cursorObservedDays: "session records + privacy-reduced usage-date evidence",
  currentStreak: "consecutive observed build days through the latest observed day",
  longestStreak: "longest run of consecutive observed build days this year",
};

export function activeDaysNote(activeDays: number): string {
  return `across ${activeDays.toLocaleString("en-US")} active calendar days`;
}

export function cursorDaysNote(sessionCountedDays: number, observedDays: number): string {
  return `${sessionCountedDays.toLocaleString("en-US")} session-counted days · ${observedDays.toLocaleString("en-US")} observed days`;
}

// Thorough plain-English explanation of what each number counts, what it
// leaves out, and how edge cases resolve. Rendered as the per-number glossary
// on /activity and inside the dashboard's methodology panel.
export const summaryCardExplanations: Record<SummaryCardId, string> = {
  contributions:
    "This is what GitHub's public contribution calendar counts for me: commits, pull requests, issues, and reviews. The note underneath is how many separate days had at least one of them. It is a tally of events, not effort — a one-line fix and an all-day refactor look identical here.",
  codexSessionDays:
    "Every distinct Codex session counts once for the calendar day it was active — home base America/Denver, living-local when I travel — and I add those up over the year. Work past midnight and the same session counts on both days — that is the quirk of the unit. Prompts, tokens, and hours never enter into it.",
  cursorSessionDays:
    "Same idea as Codex: distinct Cursor sessions per day, added up over the year, from the conversation timestamps Cursor keeps locally. Session-counted days are days with at least one of those records. Observed days adds days where Cursor's own usage export proves I used it even though no session record survived — those days get verified, but I never invent a session count for them.",
  claudeSessionDays:
    "Distinct Claude Code sessions per day, added up over the year, from its transcripts and hook events. One rule keeps this honest: credit goes to the tool, not the model. When I use a Claude model inside Cursor, that is Cursor activity, not Claude Code.",
  observedBuildDays:
    "How many days this year at least one of these tools saw me doing something — every day the Build Index sits above zero. A zero means a tool looked and found nothing. A hatched day means no tool was keeping records yet, so I honestly don't know.",
  cursorObservedDays:
    "Every day with any Cursor evidence at all: exact session records, plus days its usage export can vouch for. A vouched-for day counts here without adding to the session-day total, which is why this number can run ahead of the session-counted days.",
  currentStreak:
    "How many days in a row I've been active, counting backward from the most recent day with data. If today hasn't recorded anything yet, the count starts from yesterday — a day still in progress never breaks the streak. This one runs across the whole record, not just one year.",
  longestStreak:
    "The longest unbroken run of active days this year. These are the same days the observed-build-days number counts — just measured for how long they held together instead of how many there were.",
};
