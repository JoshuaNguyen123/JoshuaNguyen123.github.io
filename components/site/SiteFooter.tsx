import { githubUrl, linkedInUrl, resumeUrl, siteName } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="site-footer-meta">© {new Date().getFullYear()} {siteName} · Bozeman, Montana</span>
      <nav className="site-footer-links" aria-label="Footer navigation">
        <a href="/#work">Work</a>
        <a href="/blog/">Writing</a>
        <a href="/activity/">Activity</a>
        <a href="/#contact">Contact</a>
        <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer">LinkedIn</a> : null}
        {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
      </nav>
    </footer>
  );
}
