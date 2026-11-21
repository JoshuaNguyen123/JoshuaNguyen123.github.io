import { navLinks, resumeUrl, siteName, type NavKey } from "@/content/site";
import styles from "./SiteHeader.module.css";

/**
 * The one header every public page shares: the same five links in the same
 * place, with `current` marking the active one. The homepage passes
 * `variant="overlay"`, which only lays the header over the landscape and turns
 * it light, and the work pages pass `variant="night"` for their dark opening.
 * Neither changes what the header contains. Five short links fit on
 * a phone, so they wrap instead of hiding behind a menu button: navigation
 * stays visible at every width.
 */
export function SiteHeader({ current, variant }: { current?: NavKey; variant?: "overlay" | "night" }) {
  const tone = variant === "overlay" ? ` ${styles.overlay}` : variant === "night" ? " night" : "";
  return (
    <header className={`site-header${tone}`}>
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
