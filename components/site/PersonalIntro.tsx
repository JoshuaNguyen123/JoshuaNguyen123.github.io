"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { availability, currentFocus, siteName } from "@/content/site";
import styles from "./PersonalIntro.module.css";

/** The portrait settles into the page as the landscape recedes above it. */
export function PersonalIntro() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = section.getBoundingClientRect();
      const distance = Math.min(window.innerHeight * 0.72, height + window.innerHeight * 0.25);
      const progress = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (window.innerHeight - top) / distance));
      section.style.setProperty("--intro-progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} id="introduction" aria-labelledby="profile-title">
      <figure className={styles.portrait}>
        <div className={styles.aperture}>
          <Image
            src="/joshua-nguyen.jpg"
            alt="Joshua Nguyen outdoors by the water, wearing glasses, a cap, and a fleece jacket"
            width={800}
            height={1000}
            sizes="(max-width: 760px) 96px, (max-width: 1100px) 160px, 200px"
            data-portrait-image=""
          />
        </div>
        <figcaption>{siteName}<span>AI developer &amp; technical researcher</span></figcaption>
      </figure>
      <div className={styles.copy}>
        <h2 className={styles.statement} id="profile-title">I build research agents and retrieval systems that <em><a href="#work">show their work.</a></em></h2>
        <a className={styles.now} href={currentFocus.href}><span>Now</span>{currentFocus.label}</a>
        {availability ? <p className={styles.availability}>{availability}</p> : null}
      </div>
    </section>
  );
}
