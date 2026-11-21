"use client";

import { useEffect, useState } from "react";
import { READING_LINE } from "@/lib/scroll";
import styles from "./gallery.module.css";

export interface Chapter {
  id: string;
  label: string;
}

/**
 * A case study's chapters, listed beside the reading column. The one being
 * read is marked, on the same reading line the rest of the site uses. Each
 * entry is an ordinary in-page link; scrolling is never intercepted.
 */
export function ChapterRail({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(chapters[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      let current = chapters[0]?.id;
      for (const chapter of chapters) {
        const element = document.getElementById(chapter.id);
        if (element && element.getBoundingClientRect().top <= line) current = chapter.id;
      }
      setActive(current);
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
  }, [chapters]);

  return (
    <nav className={styles.rail} aria-label="Chapters of this case study">
      <ol>
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a href={`#${chapter.id}`} aria-current={active === chapter.id ? "true" : undefined}>{chapter.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
