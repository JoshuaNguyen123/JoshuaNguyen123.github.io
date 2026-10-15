import { linkedInProfileUrl } from "./linkedin-posts";

export const siteName = "Joshua Nguyen";
export const siteUrl = "https://joshuanguyen123.github.io";
export const siteTitle = "Joshua Nguyen — AI developer and technical researcher";
export const siteDescription =
  "Joshua Nguyen is an AI developer and technical researcher who likes turning ideas into useful software and sharing what he learns.";
export const githubUrl = "https://github.com/JoshuaNguyen123";
export const linkedInUrl = linkedInProfileUrl;

// Set this to "/Joshua-Nguyen-Resume.pdf" once the file is in public/ (and
// allow-listed in scripts/validate-public-repo.mjs). Until then no Resume link
// renders anywhere, so nothing dead ships.
export const resumeUrl: string | null = null;

// Same pattern for the intro's "Open to" line: set it to something like
// "Applied AI roles and scoped contract builds" and it renders; null hides it,
// so the site never publishes a guess about availability.
export const availability: string | null = null;

/** The intro's "Now" line: what is being built at the moment. */
export const currentFocus = {
  label: "Building Great Outdoors Intelligence, a conditions ranker for Montana",
  href: "/work/great-outdoors-intelligence/",
} as const;

export const ogImage = {
  url: "/og-personal.jpg",
  width: 1200,
  height: 630,
  alt: "Joshua Nguyen — AI developer and technical researcher in Bozeman, Montana",
} as const;

export const navLinks = [
  { key: "work", label: "Work", href: "/#work" },
  { key: "about", label: "About", href: "/#about" },
  { key: "writing", label: "Writing", href: "/blog/" },
  { key: "activity", label: "Activity", href: "/activity/" },
  { key: "contact", label: "Contact", href: "/#contact" },
] as const;

export type NavKey = (typeof navLinks)[number]["key"];
