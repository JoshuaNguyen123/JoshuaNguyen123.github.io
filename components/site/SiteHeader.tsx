import { navLinks, resumeUrl, siteName, type NavKey } from "@/content/site";

/**
 * The one header every public page shares; `current` marks the active link.
 * Five short links fit on a phone, so they wrap instead of hiding behind a
 * menu button: navigation stays visible at every width.
 */
export function SiteHeader({ current }: { current?: NavKey }) {
  return (
    <header className="site-header">
      <a className="wordmark" href="/" aria-label={`${siteName} home`}>
        {siteName}
      </a>
      <nav aria-label="Primary navigation">
        {navLinks.map((link) => (
          <a key={link.key} href={link.href} aria-current={link.key === current ? "page" : undefined}>
            {link.label}
          </a>
        ))}
        {resumeUrl ? <a className="site-header-resume" href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
      </nav>
    </header>
  );
}
