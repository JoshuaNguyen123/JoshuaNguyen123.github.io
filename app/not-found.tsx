import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "@/components/site/subpage.module.css";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main} id="main">
        <section className={styles.intro}>
          <p className={styles.kicker}>404</p>
          <h1>That page isn&apos;t here.</h1>
          <p className={styles.lede}>
            The address may have changed, or the note was never published.
            Everything current is one link away.
          </p>
          <div className={styles.actions}>
            <Link className={styles.link} href="/">Back to the front page</Link>
            <Link className={styles.textLink} href="/blog/">Read the writing</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
