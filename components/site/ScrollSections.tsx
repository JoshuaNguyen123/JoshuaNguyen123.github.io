"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { READING_LINE } from "@/components/work/WorkIndex";
import styles from "./subpage.module.css";

/**
 * Scroll-linked sections for subpages, on the same reading line as the
 * homepage work index. Every [data-section] inside gets --section-progress
 * (0 to 1), and data-active while it crosses the line; the stylesheet pins its
 * [data-section-label] and fills a rail beneath it. On a phone, where labels
 * sit above their content, a slim sticky bar names the current section
 * instead. Native scrolling is never intercepted, and without JavaScript the
 * page is the same static layout.
 */
export function ScrollSections({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // One measurement per frame drives every signal. Sections are queried each
    // frame because client components inside (the activity feed) can re-render.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-section]"));
      let active: HTMLElement | null = null;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
        section.style.setProperty("--section-progress", progress.toFixed(4));
        if (rect.top <= line && rect.bottom > line) active = section;
      }
      sections.forEach((section) => section.toggleAttribute("data-active", section === active));
      const bounds = root.getBoundingClientRect();
      root.style.setProperty("--page-progress", Math.min(1, Math.max(0, (line - bounds.top) / bounds.height)).toFixed(4));
      // The phone bar only appears once the tracked region reaches the top.
      setCurrent(active && bounds.top < 0 ? active.dataset.section ?? null : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.tracked}>
      <div className={styles.bar} aria-hidden="true" data-visible={current ? "" : undefined}>
        <p>{current}</p>
        <span className={styles.barTrack} />
      </div>
      {children}
    </div>
  );
}
