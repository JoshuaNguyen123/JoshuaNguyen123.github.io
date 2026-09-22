import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { navLinks, resumeUrl, siteName, type NavKey } from "@/content/site";

function NavLinks({ current }: { current?: NavKey }) {
  return (
    <>
      {navLinks.map((link) => (
        <Link key={link.key} href={link.href} aria-current={link.key === current ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
      {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
    </>
  );
}

/** The one header every public page shares; `current` underlines the active link. */
export function SiteHeader({ current }: { current?: NavKey }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label={`${siteName} home`}>
        {siteName}
      </Link>
      <nav aria-label="Primary navigation">
        <NavLinks current={current} />
      </nav>
      <MobileNav><NavLinks current={current} /></MobileNav>
    </header>
  );
}
