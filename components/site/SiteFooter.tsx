import Link from "next/link";
import { githubUrl, linkedInUrl, resumeUrl, siteName } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links" aria-label="Footer navigation">
        <Link href="/#work">Work</Link>
        <Link href="/blog/">Writing</Link>
        <Link href="/activity/">Activity</Link>
        <Link href="/#contact">Contact</Link>
        <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer">LinkedIn</a> : null}
        {resumeUrl ? <a href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
      </nav>
      <div className="site-footer-meta">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <span>Built with Next.js, published on GitHub Pages</span>
      </div>
    </footer>
  );
}