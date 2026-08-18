# Joshua Nguyen Portfolio

A fully static Next.js portfolio for `https://joshuanguyen123.github.io`. It pairs Joshua's work and interests with a privacy-safe engineering activity dashboard built from observed, source-native counts.

## Architecture

- Next.js static export (`output: "export"`); no server, database, runtime API, or CMS.
- GitHub Pages deploys `out/` through the official Pages artifact workflow.
- `public/data/activity.json` is generated and privacy-validated before every build. It is the verified fallback if the near-real-time public feed cannot be reached.
- Blog posts are optional Markdown files in `content/blog`. Empty blog navigation is hidden.
- LinkedIn embeds are optional configuration in `content/linkedin-posts.ts`. Empty configuration renders nothing and makes no LinkedIn request.

## Activity data

Public units are deliberately narrow:

- GitHub: public contributions per day.
- Codex: distinct locally retained sessions with an observed event per day.
- Cursor: active session-days from retained local conversation timestamps and user hooks, privacy-reduced daily presence from first-party usage exports, plus applied AI line changes from completed Agent and Tab edit hooks.
- Claude Code: active session-days from retained local sessions and user hooks.

Codex, Cursor, and Claude annual totals are labeled **active session-days**: one session observed on two dates contributes one to each date. They are not lifetime-session or token totals. A heatmap square represents one calendar date, so several sessions can contribute to a single square.

The Build Index is the equal-weight mean of each available provider's independently normalized daily level. Cursor contributes one observed-activity input: exact session intensity where retained session evidence exists, or light activity when a first-party usage export verifies only the date. Usage presence and line changes never add extra Cursor weight. When a provider refresh fails, its last verified data remains explicitly marked stale; unavailable sources are excluded. The index is an activity index, not a productivity score.

Export local aggregates explicitly:

```powershell
npm run activity:export
npm run activity:import:cursor -- --input "C:\path\to\usage-events.csv"
```

The local exporter reads only timestamp prefixes and transient session identifiers needed to count Codex, Cursor, and Claude activity. The Cursor usage importer validates the vendor CSV, then keeps only a binary America/Denver date-level presence series; Cloud Agent IDs, Automation IDs, models, tokens, costs, and billing kinds are discarded. Cursor request IDs and code hashes are never treated as line changes. Installed hooks reduce raw inputs in memory and persist only provider, date, event type, applied line count, and a daily keyed session hash. Public snapshots contain dates, counts, source status, coverage, and freshness only. Prompts, code, filenames, paths, project or repository names, conversation titles, models, emails, token totals, raw IDs, and raw hook payloads are forbidden by schema validation.

Providers are attributed by tool rather than model vendor. A Claude model selected inside Cursor remains Cursor activity; Claude Code counts only Claude Code sessions and hooks, even when Claude Code is launched from Cursor's integrated terminal.

The bundled static snapshot refreshes during GitHub Pages builds. The optional near-real-time collector publishes a separate public aggregate to the `activity-data` branch every five minutes when data changes; the browser polls that feed once a minute. Collection runs while this Windows account is online, and freshness remains visible per metric.

## No-cost near-real-time 2026 feed

This mode uses Cursor and Claude Code user hooks, Windows Task Scheduler, and the existing GitHub CLI login. It needs no Cursor Team plan, Claude Team or Enterprise plan, vendor analytics key, database, server, or paid monitoring service. `.env.live` is optional and is needed only to override the repository, branch, path, or GitHub token defaults.

Run the following from this repository:

```powershell
npm run activity:hooks:preflight # validates installed client versions and settings JSON
npm run activity:hooks:install   # backs up and merges global user hooks
npm run activity:preflight       # validates local collection and GitHub access without publishing
npm run activity:backfill        # publishes Jan 1, 2026 through present coverage
npm run activity:schedule        # installs the five-minute Windows scheduled task
```

The installer copies the hook runtime and owner-only ledger to `%LOCALAPPDATA%\EngineeringActivity`. It creates timestamped backups before changing `~/.cursor/hooks.json` or `~/.claude/settings.json`, merges without replacing unrelated hooks or preferences, and can be reversed with `npm run activity:hooks:uninstall`. The collector never alters the checkout and sends GitHub only the privacy-validated `activity.json` aggregate. A failed refresh preserves the last valid aggregate as `stale`; it does not delete history or turn missing coverage into zero.

Cursor applied-line coverage begins when the hooks are installed. Cursor session-days, Claude session-days, Codex session-days, and GitHub contributions are backfilled only as far as retained local or public records support. Missing earlier dates stay visibly outside source coverage.

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
