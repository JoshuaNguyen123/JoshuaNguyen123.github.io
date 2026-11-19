"use client";

import { useEffect, useRef } from "react";
import styles from "./FlyFishingScene.module.css";

export function FlyFishingScene() {
  const sceneRef = useRef<SVGSVGElement>(null);
  const fishRef = useRef<SVGGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const rippleRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const still = matchMedia("(max-width: 760px), (prefers-reduced-motion: reduce)");
    let frame = 0;
    function draw() {
      frame = 0;
      const progress = still.matches ? 0.52 : Math.min(1, window.scrollY / (innerHeight * 0.42));
      const lift = Math.sin(Math.PI * progress);
      const x = 308 + progress * 50;
      const y = 90 - lift * 50;
      fishRef.current?.setAttribute("transform", `translate(${x} ${y}) rotate(${-26 + 40 * progress})`);
      lineRef.current?.setAttribute("d", `M184 24 Q${260 + 60 * progress} ${-20 + 24 * progress} ${x} ${y}`);
      lineRef.current?.setAttribute("stroke-dashoffset", String(still.matches ? 0 : Math.max(0, 0.8 - progress * 3)));
      rippleRef.current?.setAttribute("transform", `translate(${x - 22} 90) scale(${0.55 + 0.45 * progress} 1)`);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    still.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      still.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <svg ref={sceneRef} className={styles.scene} viewBox="0 0 400 100" aria-hidden="true" focusable="false">
      <defs><clipPath id="water-surface"><rect width="400" height="90" /></clipPath></defs>
      <path d="M8 76 Q99 37 184 24 Q100 39 8 80Z" fill="#755c3e" />
      <g fill="none" stroke="#867052"><ellipse cx="126" cy="36" rx="1.8" ry="3" /><ellipse cx="165" cy="27" rx="1.2" ry="2" /></g>
      <path ref={lineRef} d="M184 24 Q291 -8 334 40" fill="none" stroke="#be8646" strokeWidth="1" pathLength="1" strokeDasharray="1"/>
      <g clipPath="url(#water-surface)"><g ref={fishRef} transform="translate(334 40) rotate(-5)">
        <image href="/images/trout-leap.webp" x="-68" y="-16" width="70" height="35" />
      </g></g>
      <g ref={rippleRef} transform="translate(312 90)" fill="none" stroke="#a18e70" opacity=".66">
        <ellipse rx="37" ry="4" /><ellipse rx="22" ry="2" />
      </g>
    </svg>
  );
}
