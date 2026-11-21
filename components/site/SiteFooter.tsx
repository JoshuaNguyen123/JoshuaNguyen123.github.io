import { githubUrl, linkedInUrl, navLinks, resumeUrl, siteName } from "@/content/site";

/** The footer repeats the header's links, then the places to find me elsewhere. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="site-footer-meta">© {new Date().getFullYear()} {siteName} · Bozeman, Montana</span>
      <nav className="site-footer-links" aria-label="Footer navigation">
        {navLinks.map((link) => <a key={link.key} href={link.href}>{link.label}</a>)}
        <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer">LinkedIn</a> : null}
        {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
      </nav>
    </footer>
  );
}
