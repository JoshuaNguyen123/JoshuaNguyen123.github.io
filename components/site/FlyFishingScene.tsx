"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import styles from "./FlyFishingScene.module.css";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** One background journey from the top of the homepage to its footer. */
export function FlyFishingScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<SVGSVGElement>(null);
  const rodRef = useRef<SVGPathElement>(null);
  const shaftRef = useRef<SVGPathElement>(null);
  const guidesRef = useRef<SVGGElement>(null);
  const runningLineRef = useRef<SVGPathElement>(null);
  const handleRef = useRef<SVGGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const spoolRef = useRef<SVGGElement>(null);
  const waterRef = useRef<SVGPathElement>(null);
  const maskRef = useRef<SVGMaskElement>(null);
  const textClearanceRef = useRef<SVGGElement>(null);
  const maskId = `fishing-clearance-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const textNodes: Text[] = [];
    const refreshText = () => {
      textNodes.length = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let textNode: Node | null;
      while ((textNode = walker.nextNode())) {
        if (textNode.textContent?.trim() && !textNode.parentElement?.closest("script,style,svg,header,#top,[aria-hidden='true']")) textNodes.push(textNode as Text);
      }
    };
    refreshText();
    const clearanceRects: SVGRectElement[] = [];

    const update = () => {
      frame = 0;
      const { width, height } = scene.getBoundingClientRect();
      // Read foreground geometry before writing animation styles. Soft holes in
      // the background preserve the original text colors and avoid visible panels.
      const clearance: DOMRect[] = [];
      const parents = new Map<Element, DOMRect>();
      for (const node of textNodes) {
        const parent = node.parentElement;
        if (!parent || !node.isConnected) continue;
        let bounds = parents.get(parent);
        if (!bounds) { bounds = parent.getBoundingClientRect(); parents.set(parent, bounds); }
        if (bounds.bottom < 0 || bounds.top > height || !bounds.width || !bounds.height) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.bottom >= 0 && rect.top <= height && rect.width && rect.height) clearance.push(rect);
      }
      const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      for (const field of document.querySelectorAll(".contact-form input:not([type='checkbox']), .contact-form textarea, .h-captcha")) {
        const rect = field.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= height && rect.width && rect.height) clearance.push(rect);
      }
      const progress = reducedMotion.matches ? 0.5 : clamp(window.scrollY / range);
      const lap = Math.min(2, Math.floor(progress * 3));
      const local = progress * 3 - lap;
      const flight = clamp((local - 0.08) / 0.84);
      const fishWidth = Math.min(196, Math.max(108, width * 0.15));
      const water = height * 0.78;
      const lift = Math.sin(Math.PI * flight);
      const startX = width * 0.68;
      const endX = Math.min(width * 0.89, width - fishWidth * 0.62 - 4);
      const x = startX + progress * (endX - startX);
      const y = water + fishWidth * 0.58 - lift * (fishWidth * 0.58 + Math.min(170, height * 0.22));
      const angle = -42 * Math.cos(Math.PI * flight);
      const tipX = width * (0.22 + Math.sin(progress * Math.PI * 6) * 0.012);
      const tipY = height * (0.28 + Math.sin(progress * Math.PI * 4) * 0.025);
      // Mouth at pixel (611, 174) in the 632 x 316 illustration. Rotate this
      // anchor with the fish so the line stays attached throughout the leap.
      const radians = angle * Math.PI / 180;
      const mouthOffsetX = fishWidth * (611 / 632 - 0.5);
      const mouthOffsetY = fishWidth * (174 / 632 - 0.25);
      const mouthX = x + mouthOffsetX * Math.cos(radians) - mouthOffsetY * Math.sin(radians);
      const mouthY = y + mouthOffsetX * Math.sin(radians) + mouthOffsetY * Math.cos(radians);
      const baseX = Math.max(22, Math.min(50, width * 0.04));
      const baseY = water - 15;
      const handleAngle = Math.atan2(water * 0.58 - baseY, tipX * 0.84 - baseX);
      const rodPoint = (t: number, offset = 0) => {
        const dx = 2 * ((1 - t) * (tipX * 0.84 - baseX) + t * (tipX - tipX * 0.84));
        const dy = 2 * ((1 - t) * (water * 0.58 - baseY) + t * (tipY - water * 0.58));
        const length = Math.hypot(dx, dy);
        return {
          x: (1 - t) ** 2 * baseX + 2 * (1 - t) * t * tipX * 0.84 + t * t * tipX - dy / length * offset,
          y: (1 - t) ** 2 * baseY + 2 * (1 - t) * t * water * 0.58 + t * t * tipY + dx / length * offset,
        };
      };
      const edges = [1, -1].map((side) => Array.from({ length: 25 }, (_, index) => {
        const t = side === 1 ? index / 24 : 1 - index / 24;
        const point = rodPoint(t, side * (1.45 * (1 - t) + 0.2));
        return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }));
      const loop = Math.sin(Math.PI * local);
      const splash = Math.max(0, 1 - Math.abs(flight - 0.89) / 0.11);
      const landingProgress = (lap + 0.08 + 0.84 * 0.89) / 3;
      const drift = Math.sin(progress * Math.PI * 4) * 16;

      maskRef.current?.setAttribute("width", `${width}`);
      maskRef.current?.setAttribute("height", `${height}`);
      for (let index = 0; index < clearance.length; index++) {
        if (!clearanceRects[index]) {
          const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          textClearanceRef.current?.appendChild(rect);
          clearanceRects.push(rect);
        }
        const node = clearanceRects[index], rect = clearance[index];
        node.removeAttribute("display");
        node.setAttribute("x", `${rect.left - 9}`);
        node.setAttribute("y", `${rect.top - 7}`);
        node.setAttribute("width", `${rect.width + 18}`);
        node.setAttribute("height", `${rect.height + 14}`);
        node.setAttribute("rx", "5");
      }
      for (let index = clearance.length; index < clearanceRects.length; index++) clearanceRects[index].setAttribute("display", "none");
      scene.setAttribute("data-background-ready", "");
      scene.style.setProperty("--fish-x", `${x.toFixed(2)}px`);
      scene.style.setProperty("--fish-y", `${y.toFixed(2)}px`);
      scene.style.setProperty("--fish-angle", `${angle.toFixed(2)}deg`);
      scene.style.setProperty("--fish-width", `${fishWidth.toFixed(2)}px`);
      scene.style.setProperty("--mouth-x", `${mouthX.toFixed(2)}px`);
      scene.style.setProperty("--mouth-y", `${mouthY.toFixed(2)}px`);
      scene.style.setProperty("--rod-tip-x", `${tipX.toFixed(2)}px`);
      scene.style.setProperty("--rod-tip-y", `${tipY.toFixed(2)}px`);
      scene.style.setProperty("--reel-x", `${baseX + Math.cos(handleAngle) * 6 - Math.sin(handleAngle) * 17}px`);
      scene.style.setProperty("--reel-y", `${baseY + Math.sin(handleAngle) * 6 + Math.cos(handleAngle) * 17}px`);
      scene.style.setProperty("--rod-angle", `${handleAngle * 180 / Math.PI}deg`);
      scene.style.setProperty("--splash-x", `${(startX + (endX - startX) * landingProgress).toFixed(2)}px`);
      scene.style.setProperty("--splash-opacity", reducedMotion.matches ? "0" : splash.toFixed(3));
      scene.style.setProperty("--splash-scale", (0.6 + splash * 0.8).toFixed(3));
      scene.style.setProperty("--page-progress", progress.toFixed(6));
      scene.style.setProperty("--cast-progress", local.toFixed(6));
      scene.style.setProperty("--line-presence", (0.15 + lift * 0.85).toFixed(4));
      drawingRef.current?.setAttribute("viewBox", `0 0 ${width} ${height}`);
      rodRef.current?.setAttribute("d", `M ${baseX} ${baseY} Q ${tipX * 0.84} ${water * 0.58} ${tipX} ${tipY}`);
      shaftRef.current?.setAttribute("d", `M ${edges[0].join(" L ")} L ${edges[1].join(" L ")} Z`);
      handleRef.current?.setAttribute("transform", `translate(${baseX} ${baseY}) rotate(${handleAngle * 180 / Math.PI})`);
      const guidePositions = [0.15, 0.32, 0.5, 0.68, 0.84, 0.96];
      for (const [index, t] of guidePositions.entries()) {
        const point = rodPoint(t, 1.8 + (1 - t) * 2);
        const radius = 1 + (1 - t) * 2.2;
        const guide = guidesRef.current?.children[index];
        guide?.setAttribute("cx", `${point.x}`);
        guide?.setAttribute("cy", `${point.y}`);
        guide?.setAttribute("r", `${radius}`);
      }
      runningLineRef.current?.setAttribute("d", `M ${baseX + Math.cos(handleAngle) * 11 - Math.sin(handleAngle) * 9} ${baseY + Math.sin(handleAngle) * 11 + Math.cos(handleAngle) * 9} L ${guidePositions.map((t) => { const point = rodPoint(t, 1.8 + (1 - t) * 2); return `${point.x} ${point.y}`; }).join(" L ")} L ${tipX} ${tipY}`);
      lineRef.current?.setAttribute("d", `M 0 0 C 35 ${-24 * loop}, 115 ${-12 * (1 - loop)}, 100 100`);
      spoolRef.current?.setAttribute("transform", `rotate(${(progress * 1620).toFixed(2)} 17 17)`);
      waterRef.current?.setAttribute("d", `M -40 ${water} Q ${width * 0.25} ${water - 12 + drift} ${width * 0.5} ${water} T ${width + 40} ${water} M -40 ${water + 24} C ${width * 0.3} ${water + 8 - drift}, ${width * 0.7} ${water + 40 + drift}, ${width + 40} ${water + 18}`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(scene);
    resize.observe(document.body);
    // Contact status and project controls can add text after hydration.
    const mutation = new MutationObserver((records) => {
      const foreground = records.filter((record) => !scene.contains(record.target));
      if (!foreground.length) return;
      if (foreground.some((record) => record.type !== "attributes")) refreshText();
      schedule();
    });
    mutation.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["data-featured", "open", "style"] });
    document.fonts.addEventListener("loadingdone", schedule);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      for (const rect of clearanceRects) rect.remove();
      scene.removeAttribute("data-background-ready");
    };
  }, []);

  return (
    <div className={styles.scene} ref={sceneRef} data-fishing-scene="" data-page-background="" aria-hidden="true">
      <svg className={styles.maskDefinitions} focusable="false">
        <defs>
          <filter id={`${maskId}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
          <mask ref={maskRef} id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="10000" height="10000" style={{ maskType: "luminance" }}>
            <rect x="0" y="0" width="10000" height="10000" fill="white" />
            <g ref={textClearanceRef} fill="black" filter={`url(#${maskId}-soft)`} />
          </mask>
        </defs>
      </svg>
      <div className={styles.illustration} style={{ maskImage: `url(#${maskId})` }}>
        <svg ref={drawingRef} className={styles.cast} viewBox="0 0 1000 800" preserveAspectRatio="none" focusable="false">
          <path ref={waterRef} className={styles.water} d="M 0 624 Q 250 612 500 624 T 1000 624 M 0 648 Q 500 630 1000 642" />
          <path ref={rodRef} data-rod-centerline="" className={styles.rod} d="M 40 609 Q 185 362 220 224" />
          <path ref={shaftRef} className={styles.shaft} />
          <path ref={runningLineRef} className={styles.runningLine} />
          <g ref={guidesRef} className={styles.guides}>{[0, 1, 2, 3, 4, 5].map((index) => <circle key={index} />)}</g>
          <g ref={handleRef} className={styles.handle} data-rod-grip="" transform="translate(40 609) rotate(-60)">
            <path className={styles.seat} d="M -4 -2 L 13 -2 L 13 2 L -4 2 Z" />
            <path className={styles.cork} d="M 13 -2.8 Q 21 -5 29 -3.6 L 47 -2.8 Q 51 0 47 2.8 L 29 3.6 Q 21 5 13 2.8 Z" />
            <path className={styles.corkGrain} d="M 17 -3 L 17 3 M 22 -3.5 L 22 3.5 M 28 -3 L 28 3 M 34 -2.8 L 34 2.8 M 41 -2.5 L 41 2.5 M 46 -2 L 46 2" />
            <path className={styles.ferrules} d="M -3 -2 L -3 2 M 10 -2 L 10 2 M 51 -1.7 L 51 1.7 M 54 -1.7 L 54 1.7" />
          </g>
        </svg>
        <svg className={styles.reel} data-fly-reel="" viewBox="0 0 34 34" focusable="false">
          <path d="M 17 6 L 16 3 L 23 0" />
          <circle cx="17" cy="17" r="11" />
          <circle cx="17" cy="17" r="8.2" />
          <g ref={spoolRef}>
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <circle key={angle} cx={17 + Math.cos(angle * Math.PI / 180) * 5.9} cy={17 + Math.sin(angle * Math.PI / 180) * 5.9} r="1.25" />
            ))}
            <circle cx="17" cy="17" r="2" />
            <path d="M 18.5 18 L 22 20" />
            <circle cx="23" cy="20.5" r="1.6" />
          </g>
        </svg>
        <div className={styles.air}>
          <div className={styles.fish} data-trout="">
            <Image src="/images/trout-leap.webp" alt="" width={632} height={316} sizes="196px" loading="eager" />
          </div>
          <svg className={styles.fishingLine} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" data-fishing-line="">
            <path ref={lineRef} d="M 0 0 C 35 -24 115 0 100 100" />
          </svg>
        </div>
        <svg className={styles.splash} viewBox="0 0 80 42" focusable="false">
          <ellipse cx="40" cy="30" rx="34" ry="6" />
          <ellipse cx="40" cy="30" rx="19" ry="3" />
          <path d="M 24 19 Q 20 10 15 8 M 39 13 L 38 3 M 54 18 Q 59 8 64 9" />
        </svg>
      </div>
    </div>
  );
}
