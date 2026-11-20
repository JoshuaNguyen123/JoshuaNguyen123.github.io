// Renders public/og-personal.jpg, the 1200x630 card that link previews show.
// The card is drawn from the built homepage itself: it opens out/index.html in
// a headless browser, reads the hero's own headline, subline, photo, scrim and
// edge curve, and lays them out for the card's proportions. The site's
// stylesheet and fonts stay loaded, so the card cannot drift from the design
// unless this script is not run after the hero changes.
// Usage: npm run build, then npm run og:render. The image is committed.
// Needs Playwright with Chromium, which is not a project dependency:
//   npm install --no-save playwright && npx playwright install chromium
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createStaticPreview } from "./preview.mjs";

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT = "public/og-personal.jpg";

const outRoot = path.resolve("out");
await access(path.join(outRoot, "index.html")).catch(() => {
  throw new Error("No static export found. Run npm run build first.");
});

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  throw new Error("Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium");
}

const server = createStaticPreview(outRoot);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview server failed to bind");
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });

  // Everything the card shows is read from the live hero, then the page body
  // is replaced by the card. The body keeps its class, which carries the fonts.
  await page.evaluate(({ width, height }) => {
    const text = (selector) => {
      const element = document.querySelector(selector);
      if (!element?.textContent?.trim()) throw new Error(`The homepage hero is missing ${selector}`);
      return element.textContent.trim();
    };
    const photo = document.querySelector("[data-scene-photo] img");
    const shade = document.querySelector("[data-landscape-frame] > [aria-hidden]");
    const edge = document.querySelector("#valley-edge path");
    if (!photo || !shade || !edge) throw new Error("The homepage hero is missing its photo, scrim, or edge curve");
    const hero = {
      name: text("header .wordmark"),
      headline: text("[data-hero-copy] h1"),
      subline: text("[data-hero-copy] p"),
      photo: photo.currentSrc || photo.src,
      focus: getComputedStyle(photo).objectPosition,
      scrim: getComputedStyle(shade).backgroundImage,
      edge: edge.getAttribute("d"),
    };

    // The markup below is a fixed literal. Every value read from the page is
    // set afterwards through textContent or an attribute, never as HTML.
    const card = document.createElement("div");
    card.className = "og-card";
    card.innerHTML = `
      <svg width="0" height="0" aria-hidden="true"><defs><clipPath id="og-edge" clipPathUnits="objectBoundingBox"><path /></clipPath></defs></svg>
      <div class="og-scene"><img alt="" /><div class="og-scrim"></div></div>
      <p class="og-name"></p>
      <div class="og-copy"><h1></h1><p></p></div>`;
    card.querySelector("clipPath path").setAttribute("d", hero.edge);
    card.querySelector("img").src = hero.photo;
    card.querySelector("img").style.objectPosition = hero.focus;
    card.querySelector(".og-scrim").style.backgroundImage = hero.scrim;
    card.querySelector(".og-name").textContent = hero.name;
    card.querySelector("h1").textContent = hero.headline;
    card.querySelector(".og-copy p").textContent = hero.subline;

    const style = document.createElement("style");
    style.textContent = `
      html, body { background: var(--paper); height: ${height}px; margin: 0; overflow: hidden; width: ${width}px; }
      .og-card { color: var(--on-image); font-family: var(--font-sans); height: ${height}px; position: relative; width: ${width}px; }
      .og-card svg { position: absolute; }
      .og-scene { clip-path: url(#og-edge); inset: 0; position: absolute; }
      .og-scene img { display: block; height: 100%; object-fit: cover; width: 100%; }
      .og-scrim { inset: 0; position: absolute; }
      .og-name { font-size: 26px; font-weight: 500; left: 76px; letter-spacing: -.02em; margin: 0; position: absolute; top: 54px; }
      .og-copy { left: 76px; position: absolute; right: 76px; top: 178px; }
      .og-copy h1 { font-size: 112px; font-weight: 430; letter-spacing: -.035em; line-height: 1.04; margin: 0; }
      .og-copy p { font-size: 34px; letter-spacing: -.01em; line-height: 1.3; margin: 20px 0 0; max-width: 640px; }`;
    document.body.replaceChildren(card);
    document.head.append(style);
  }, { width: WIDTH, height: HEIGHT });

  await page.evaluate(async () => {
    const photo = document.querySelector(".og-scene img");
    if (!photo.complete) await new Promise((resolve, reject) => { photo.onload = resolve; photo.onerror = reject; });
    await document.fonts.ready;
  });
  await page.screenshot({ path: OUTPUT, type: "jpeg", quality: 88 });
  console.log(`wrote ${path.normalize(OUTPUT)} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
