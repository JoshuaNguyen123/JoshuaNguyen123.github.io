import { MobileNav } from "./MobileNav";
import { navLinks, resumeUrl, siteName, type NavKey } from "@/content/site";

function NavLinks({ current }: { current?: NavKey }) {
  return (
    <>
      {navLinks.map((link) => (
        <a key={link.key} href={link.href} aria-current={link.key === current ? "page" : undefined}>
          {link.label}
        </a>
      ))}
      {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
    </>
  );
}

/** The one header every public page shares; `current` underlines the active link. */
export function SiteHeader({ current }: { current?: NavKey }) {
  return (
    <header className="site-header">
      <div className="site-identity">
        <a className="wordmark" href="/" aria-label={`${siteName} home`}>
          {siteName}
        </a>
        <span className="site-location">Bozeman, Montana</span>
      </div>
      <nav aria-label="Primary navigation">
        <NavLinks current={current} />
      </nav>
      <MobileNav><NavLinks current={current} /></MobileNav>
    </header>
  );
}
