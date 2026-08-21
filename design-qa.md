# Design QA — Concise personal portfolio

## Evidence

- Intended direction: the approved editorial portfolio, refined from user feedback toward concise role-led copy, smaller headings, consistent supporting type, and near-black text.
- Rendered implementation: local production static export served through an approved headless Microsoft Edge fallback.
- Desktop homepage and writing captures: 1440 × 1050 pixels, stored outside the repository.
- Narrow homepage and writing captures: 500 × 1000 pixels, stored outside the repository.
- State: light theme, homepage top, activity dashboard, selected work, and zero-published-post writing state.

## Visual review

- Fonts and typography: Newsreader is limited to headings and editorial article text. Geist Sans now handles supporting copy and labels consistently; Geist Mono remains limited to the protected data surface and code.
- Spacing and layout: the shorter role-led hero, compact writing masthead, and reduced heading scale retain clear rhythm. Activity heatmaps now use a fluid week grid and fit the 500px narrow capture without horizontal scrolling; the final summary metric spans the remaining row.
- Colors and tokens: supporting text on light surfaces uses near-black ink rather than low-contrast gray. The activity heatmaps now use color-blind-safe sequential ramps with strong lightness steps; provider identity is reinforced by labels and distinct Okabe-Ito marker shapes rather than color alone.
- Image quality: no imagery, logos, decorative illustrations, or placeholder assets are used, matching the approved type-led direction.
- Copy and content: the hero is now `FDE, AI developer, and technical researcher.`; the about line is the direct, personal `I like solving problems—technically and operationally.` Public-facing arrow and emoji glyphs are absent. Selected work is ranked by current public-code depth: Obsidian Research Agent, Engineering Activity Portfolio, Environmental Quality ML Dashboard, then Book Service API.

## Rejected captures

- The earlier verbose-heading screenshots were superseded by the concise-copy captures above.
- True 390px emulation remains unavailable in the approved Edge fallback, so the accepted narrow evidence uses 500px.

## Evidence limits

- There is no exact source visual to place beside the implementation, so formal fidelity comparison cannot pass.
- The approved Edge fallback captures visual output but does not provide in-app Browser interaction and console evidence for a formal Product Design pass.
- The accepted narrow captures prove the responsive breakpoint at 500px, not a true 390px device emulation.

final result: blocked
