"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./CinematicHero.module.css";

/** The landscape shifts gently as the project introduction comes into view. */
export function CinematicHero({ children }: { children?: ReactNode }) {
  const openingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opening = openingRef.current;
    if (!opening) return;
    const staticLayout = window.matchMedia("(max-width: 760px), (prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = staticLayout.matches ? 0 : Math.min(1, Math.max(0, -opening.getBoundingClientRect().top / (window.innerHeight * 0.48)));
      opening.style.setProperty("--photo-offset", `${progress * 22}px`);
    };
    const schedule = () => {
      if (!frame && !staticLayout.matches) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    staticLayout.addEventListener("change", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      staticLayout.removeEventListener("change", update);
    };
  }, []);

  return (
    <div ref={openingRef} className={styles.opening} data-opening-scene="">
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs><clipPath id="valley-edge" clipPathUnits="objectBoundingBox">
          <path d="M0 0 H1 V.90 C.79 .93 .68 1 .53 .99 S.14 .79 0 .85 Z" />
        </clipPath></defs>
      </svg>
      <div className={styles.scene} data-landscape-frame="">
        <div className={styles.photo} data-scene-photo="">
          <Image
            src="/images/hiking-valley.jpg"
            alt="A rocky mountain valley opening onto distant country, beneath a blue sky"
            fill
            sizes="100vw"
            preload
            className={styles.image}
          />
        </div>
        <div className={styles.shade} aria-hidden="true" />
      </div>
      <section className={styles.hero} id="top" aria-labelledby="intro-title">
        <div className={styles.copy} data-hero-copy="">
          <h1 id="intro-title">Hi, I’m Josh.</h1>
          <p>I’m into AI, engineering, and technology.</p>
        </div>
      </section>
      {children}
    </div>
  );
}
