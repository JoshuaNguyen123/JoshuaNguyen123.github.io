# Joshua Nguyen Portfolio

A fully static Next.js portfolio for `https://joshuanguyen123.github.io`. It pairs Joshua's work and interests with a privacy-safe engineering activity dashboard built from observed, source-native counts.

## Architecture

- Next.js static export (`output: "export"`); no server, database, runtime API, or CMS.
- GitHub Pages deploys `out/` through the official Pages artifact workflow.
- `public/data/activity.json` is generated and privacy-validated before every build.
- Blog posts are optional Markdown files in `content/blog`. Empty blog navigation is hidden.
- LinkedIn embeds are optional configuration in `content/linkedin-posts.ts`. Empty configuration renders nothing and makes no LinkedIn request.

## Activity data

Public units are deliberately narrow:

- GitHub: public contributions per day.
- Codex: distinct locally retained sessions with an observed event per day.
- Cursor: unavailable until a first-party aggregate export can reproduce the AI Line Edits metric.
- Claude Code: distinct locally retained sessions with an observed event per day.

Codex and Claude annual totals are labeled **active session-days**: one session observed on two dates contributes one to each date. They are not lifetime-session or token totals.

The Build Index is the equal-weight mean of each available provider's independently normalized daily level. It is an activity index, not a productivity score.

Export local aggregates explicitly:

```powershell
npm run activity:export
```

The exporter reads only timestamp prefixes and transient session identifiers needed to count Codex and Claude Code activity. Cursor request IDs are deliberately not published because they do not reproduce Cursor's AI Line Edits metric. The committed snapshot contains dates, counts, source status, coverage, and freshness only. Prompts, code, filenames, paths, project or repository names, conversation titles, models, token totals, and raw IDs are forbidden by schema validation.

Local Codex and Claude Code freshness therefore reflects the most recently committed export. GitHub Actions refreshes the public GitHub contribution calendar on `main`, manual runs, and a six-hour schedule. Cursor remains visibly unavailable and is excluded from the Build Index until a compatible first-party aggregate is configured.

## Local development

Node.js 24 is recommended.

```powershell
npm install
npm run activity:export
$env:GITHUB_TOKEN = "your-token"
npm run activity:prepare
npm run dev
```

`npm run dev` explicitly prepares synthetic fixtures for local visual development. Fixtures are labeled, rejected by the public privacy check, and forbidden in CI. The production build uses observed snapshots only:

```powershell
npm run verify
```

## Blog posts

Add a `.md` file to `content/blog` with exactly these frontmatter fields:

```yaml
---
slug: durable-url-slug
title: Real article title
summary: Short public summary.
publishedAt: 2026-08-11
tags:
  - engineering
draft: false
---
```

No placeholder posts are published. Invalid or unexpected frontmatter blocks the build.

## LinkedIn posts

Add public post entries to `content/linkedin-posts.ts`. Until a post or profile URL is supplied, the widget returns nothing. Configured cards use responsive, lazy-loaded LinkedIn embed URLs and disclose that their content is served by LinkedIn. Automatic personal profile-feed retrieval is intentionally out of scope because it requires restricted API access and a backend.

## Verification

```powershell
npm run lint
npm test
npm run build
npm run privacy:check
node scripts/smoke-export.mjs
```

The build fails on malformed provider data, forbidden public properties, fixture mode, failed GitHub refreshes in Actions, or static export smoke-test regressions. A failed workflow does not replace the last successful Pages deployment.
