# Design QA — Personal portfolio option 2

## Evidence

- Source visual truth: local ImageGen result retained outside the repository.
- Final desktop implementation: local 1280 × 720 browser capture retained outside the repository.
- Final phone implementation: local 390 × 844 browser capture retained outside the repository.
- First-pass desktop implementation: local 1280 × 720 browser capture retained outside the repository.
- Source pixels: 1488 × 1058. Generated target: 1440 × 1024. Density: 1×.
- Desktop browser capture: 1280 × 720 pixels at a 1280 × 720 CSS viewport, 1× density.
- Phone browser capture: 390 × 844 pixels at a 390 × 844 CSS viewport, 1× density.
- State: home route, light theme, top of page; activity interactions were tested separately on the same production build.
- Normalization: the in-app browser capped the desktop capture at 1280 × 720. The source was compared at original resolution and normalized by a 0.860 width scale for the shared header/hero region. The source's taller vertical canvas was not treated as a spacing defect. The mockup's invented activity data/UI was excluded from fidelity scoring because the user's explicit constraint makes the existing activity component authoritative.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Typography: the existing Geist Sans and Geist Mono pair matches the source's neutral sans/technical-mono contrast. The final headline uses the source's four-line wrap, restrained weight, tight tracking, and readable body scale.
- Spacing and layout: the wordmark, centered navigation, left editorial column, vertical divider, and “Right now” column preserve the source hierarchy after width normalization. The 390 px layout stacks naturally with no page-level horizontal overflow.
- Colors and tokens: the existing paper, ink, muted text, warm accent, rules, and green status colors match the selected direction; no new visual system was introduced.
- Image quality and assets: the selected design contains no raster imagery, illustration, logo artwork, or non-standard icon assets. No placeholders or generated decorative assets were needed.
- Copy and content: the first-person introduction, focus list, location, and quiet links match the chosen personal direction. The source's dated eyebrow was intentionally replaced by Joshua's identity to avoid presenting a stale update date.
- Protected activity surface: `ActivityDashboard`, `ActivitySummary`, and `ActivityHeatmap` source files were not edited. Its metrics, tiles, controls, data semantics, colors, and responsive behavior remain authoritative even where ImageGen depicted invented activity UI.

## Focused comparison

- The reference and final implementation were opened together for direct visual review.
- Hero typography was reviewed separately because line wrapping was the main fidelity risk: the first implementation wrapped the headline in three lines; the final implementation wraps it in four, matching the reference.
- Browser-computed final desktop geometry: headline width 560 px and four lines; the aside begins at the same normalized region as the reference. No focused asset crop was needed because the screen has no image assets.

## Comparison history

1. First pass — blocked by one P2: the headline was too large/wide, wrapped in three lines, and pushed the aside too far right.
2. Fix — reduced the headline scale, narrowed its measure and body-copy measure, rebalanced the hero columns, and moved the aside upward.
3. Intermediate pass — the overall composition improved, but the 610 px headline measure still produced three lines.
4. Fix — reduced the headline measure to 560 px and body measure to 565 px.
5. Final pass — four-line headline, matching editorial hierarchy, aligned focus column, no clipping, and no actionable P0/P1/P2 findings.

## Responsive and interaction checks

- 390 × 844: desktop navigation hides, wordmark remains legible, copy wraps without clipping, and the page has no global horizontal overflow.
- The activity heatmap remains intentionally horizontally scrollable on phone: 342 px visible width and 624 px internal canvas width.
- “Read writing” navigated to `/blog/` and rendered “Published notes.”
- “View activity” reached the activity section.
- “Usage evidence” became the selected metric with `aria-pressed="true"`.
- Selecting a heatmap tile updated its pressed state and the day-detail heading to Sunday, January 11, 2026.
- Browser console check after navigation and activity interaction: no warnings or errors.

## Implementation checklist

- [x] Preserve the activity component and heatmap behavior.
- [x] Replace product-advertising language with first-person portfolio language.
- [x] Match the selected header and hero hierarchy.
- [x] Keep desktop and phone layouts responsive and accessible.
- [x] Verify navigation, activity controls, build, tests, lint, and browser console.

## Follow-up polish

- P3: the source uses a dated eyebrow and a tiny location icon; the implementation keeps an identity eyebrow and text-only location to avoid stale freshness claims and unnecessary decorative assets.

final result: passed
