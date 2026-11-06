"use client";

import { useEffect, useRef } from "react";
import { currentFocus, siteName } from "@/content/site";
import styles from "./PersonalIntro.module.css";

/**
 * The statement settles into the page as the landscape recedes above it. The
 * byline sits in the same label column as every section below, so the intro
 * reads as the first section rather than a separate card; the portrait lives
 * with the personal copy in About.
 */
export function PersonalIntro() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const staticLayout = window.matchMedia("(max-width: 760px), (prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = section.getBoundingClientRect();
      const distance = Math.min(window.innerHeight * 0.72, height + window.innerHeight * 0.25);
      const progress = staticLayout.matches ? 1 : Math.min(1, Math.max(0, (window.innerHeight - top) / distance));
      section.style.setProperty("--intro-progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame && !staticLayout.matches) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    staticLayout.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      staticLayout.removeEventListener("change", update);
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} id="introduction" aria-labelledby="profile-title">
      <p className={styles.byline}>{siteName}<span>AI developer &amp; technical researcher</span></p>
      <div className={styles.copy}>
        <h2 className={styles.statement} id="profile-title">I build research agents and retrieval systems that <em><a href="#work">show their work.</a></em></h2>
        <a className={styles.now} href={currentFocus.href}><span>Now</span>{currentFocus.label}</a>
      </div>
    </section>
  );
}
