# Engineering Activity Portfolio

A public personal site centered on a privacy-safe engineering activity dashboard. The dashboard combines GitHub contributions with editor and AI-tool activity from WakaTime, normalizes each provider independently, and renders an overall build signal without comparing unlike raw units.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Development uses deterministic fixture telemetry when `ACTIVITY_USE_FIXTURES` is unset. Fixture mode is visibly labeled and is never presented as live data. Set `ACTIVITY_USE_FIXTURES=false` to verify the unconfigured state.

## Live provider configuration

Copy `.env.example` to `.env.local` and add only the integrations you want to publish.

```env
GITHUB_USERNAME=
GITHUB_TOKEN=
WAKATIME_API_KEY=
ACTIVITY_USE_FIXTURES=false
```

- GitHub uses the GraphQL contribution calendar. The token remains server-side; only daily aggregate contribution counts are returned to the browser.
- WakaTime uses daily summaries and their editor breakdown to attribute active minutes to Cursor, Codex, and Claude Code.
- Tool attribution defaults to editor-name matching. Override `WAKATIME_*_MATCH` values when the names in your WakaTime summaries differ.
- A missing or failing provider is isolated and shown as not connected; other providers continue to render.

WakaTime cannot always distinguish terminal AI tools unless the installed telemetry records a distinct editor name. The adapter boundary is intentionally separate so richer Codex or Claude telemetry can replace editor matching later.

## Privacy

Public responses contain daily totals and normalized intensity only. Repository names, project names, tokens, prompts, file paths, source content, and tool-call arguments are disabled in `lib/activity/privacy.ts`.

## API

`GET /api/activity?start=2026-01-01&end=2026-08-11`

Ranges are limited to 367 days. Responses are cached for 15 minutes with stale-while-revalidate support, and provider requests also use a server-side in-memory cache.

## Verification

```bash
npm run lint
npm test
```

The test suite covers weekday placement, partial calendar weeks, leap years, year boundaries, normalization edge cases, streaks, aggregation, and server-rendered page output.
