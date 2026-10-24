"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./CinematicHero.module.css";

/** Native scroll pulls the landscape into a frame, with separate photo/type depths. */
export function CinematicHero({ children }: { children?: ReactNode }) {
  const openingRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const landscapeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const photo = photoRef.current;
    const opening = openingRef.current;
    if (!hero || !photo || !opening) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = hero.getBoundingClientRect();
      const offset = reducedMotion.matches ? 0 : Math.min(height, Math.max(0, -top)) * 0.08;
      const progress = reducedMotion.matches ? 0 : Math.min(1, Math.max(0, -top / (height * 0.72)));
      opening.toggleAttribute("data-scroll-motion", !reducedMotion.matches);
      // Clip the lingering photo at the introduction's edge, leaving the
      // shared page background visible through the transparent introduction.
      const bottom = landscapeRef.current?.getBoundingClientRect().bottom ?? top + height;
      const cover = reducedMotion.matches ? 0 : Math.min(height, Math.max(0, bottom - (top + height)));
      opening.style.setProperty("--landscape-cover", `${cover.toFixed(2)}px`);
      photo.style.setProperty("--photo-offset", `${offset.toFixed(1)}px`);
      opening.style.setProperty("--hero-progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      opening.removeAttribute("data-scroll-motion");
    };
  }, []);

  return (
    <div ref={openingRef} className={styles.opening} data-opening-scene="">
      <div ref={landscapeRef} className={styles.scene} data-landscape-frame="">
        <div className={styles.photo} ref={photoRef} data-scene-photo="">
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
      <section ref={heroRef} className={styles.hero} id="top" aria-labelledby="intro-title">
        <div className={styles.copy} data-hero-copy="">
          <h1 id="intro-title"><span>Useful software.</span><span>Room to explore.</span></h1>
          <a className={styles.explore} href="#work">Explore my work <ArrowRight size={21} weight="light" aria-hidden="true" /></a>
        </div>
        <p className={styles.location}><span>Based in</span>Bozeman, Montana</p>
      </section>
      {children}
    </div>
  );
}
