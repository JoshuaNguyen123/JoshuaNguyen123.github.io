import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="not-found" id="main">
        <span className="eyebrow">404</span>
        <h1>That page isn&apos;t here.</h1>
        <p>
          The address may have changed, or the note was never published.
          Everything current is one link away.
        </p>
        <div className="hero-actions">
          <Link className="primary-link" href="/">Back to the front page</Link>
          <Link className="text-link" href="/blog/">Read the writing</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}