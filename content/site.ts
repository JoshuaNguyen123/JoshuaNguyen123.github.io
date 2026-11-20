import { linkedInProfileUrl } from "./linkedin-posts";

export const siteName = "Joshua Nguyen";
export const siteUrl = "https://joshuanguyen123.github.io";
export const siteTitle = "Joshua Nguyen, AI developer and technical researcher";
export const siteDescription =
  "Joshua Nguyen is an AI developer and technical researcher in Bozeman, Montana. This site has his projects, their case studies, and notes on building AI agents.";
export const githubUrl = "https://github.com/JoshuaNguyen123";
export const linkedInUrl = linkedInProfileUrl;

// Set this to "/Joshua-Nguyen-Resume.pdf" once the file is in public/ (and
// allow-listed in scripts/validate-public-repo.mjs). Until then no Resume link
// renders anywhere, so nothing dead ships.
export const resumeUrl: string | null = null;

/** The intro's "Now" line: what is being built at the moment. */
export const currentFocus = {
  label: "Building Research Agent Platform, a desktop research workspace",
  href: "/work/research-agent-platform/",
} as const;

// The link-preview card. It is rendered from the homepage hero by `npm run og:render`;
// run that again after changing the hero's photo, headline, subline, or typeface.
export const ogImage = {
  url: "/og-personal.jpg",
  width: 1200,
  height: 630,
  alt: "A rocky mountain valley under a blue sky, with the words: Hi, I’m Josh. AI developer and technical researcher in Bozeman, Montana.",
} as const;

export const navLinks = [
  { key: "work", label: "Work", href: "/#work" },
  { key: "about", label: "About", href: "/#about" },
  { key: "writing", label: "Writing", href: "/blog/" },
  { key: "activity", label: "Activity", href: "/activity/" },
  { key: "contact", label: "Contact", href: "/#contact" },
] as const;

export type NavKey = (typeof navLinks)[number]["key"];
