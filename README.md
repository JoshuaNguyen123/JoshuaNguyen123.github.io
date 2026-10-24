# Joshua Nguyen's Personal Website

This is my corner of the internet: a place to share what I’m building, what I’m learning, and the questions I keep coming back to.

## Website

[**Open the live website**](https://joshuanguyen123.github.io/)

## What's here

- A little about me and the work I care about
- Selected projects and notes from the workbench
- A privacy-conscious view of my recent engineering activity

I built the site with Next.js and publish it as a static site on GitHub Pages. The activity view uses daily aggregate counts only; it never publishes prompts, source code, filenames, project names, or raw session data.

## Run it locally

Node.js 24 is recommended.

```powershell
npm install
npm run dev
```

To refresh activity and run the existing full checks:

```powershell
npm run verify
```

## Prepare a release without deploying

Use `npm ci` for a clean dependency install. Then supply the public contact configuration from `.env.example` in the build environment, or use the existing public GitHub repository variables through your authenticated GitHub CLI:

```powershell
npm run release:check -- --repo-vars
```

Without GitHub CLI, set the public contact variables in the process environment and run `npm run release:check`. This gate requires working contact configuration, scans tracked and new source files for accidental public data, and runs lint, all tests, activity reconciliation, privacy validation, a static production build, and export/HTTP smoke checks. It uses the current activity snapshot without collecting or refreshing personal activity. Its GitHub counts must match the published snapshot in `HEAD`; local tool counts reconcile to their source aggregates plus previously published history. The normal refreshed build continues to audit GitHub against its collection cache.

The command also audits production dependencies and blocks high or critical advisories. It writes `portfolio.tar.gz`, a SHA-256 file manifest, step logs, and a receipt under ignored `outputs/releases/<timestamp>/`. A failed run retains its receipt and creates no candidate archive. The receipt identifies the commit, working source digest, configuration mode, and artifact digest; it never records configuration values. Public contact values are intentionally included in browser bundles. Never use private service secrets as `NEXT_PUBLIC_*` values.

Review the exact export on desktop and phone, including keyboard navigation, the graph case study, scroll reversal and reduced motion, and contact failure/recovery. Real hCaptcha completion and message delivery on the production hostname remain a separate live acceptance check; local mocked submissions do not prove email delivery.

The contact form loads compact hCaptcha near the form or when a field receives focus. Failed or stalled SDK loads expose a Retry captcha action without discarding the draft; expired challenges ask for verification again. The release and export smoke checks require the configured captcha inside the shipped form and the CSP origins it needs. Captcha tokens are checked by the configured contact worker or the existing Web3Forms integration before delivery.

For direct Web3Forms delivery, also enable mandatory hCaptcha on this form in the provider dashboard, as described in [its integration guide](https://docs.web3forms.com/getting-started/customizations/spam-protection/hcaptcha). Rendering the widget and rejecting an empty token in the browser do not prove that this account setting is enabled. Confirm that setting before promotion; checking it must not send a message. Switching to the optional worker requires its own configured secrets and live acceptance, including the delivery provider's support for a server relay.

Use `npm run preview` (or `npm start`) to serve `out/` at `http://127.0.0.1:4183/`. To review a retained archive, extract it into a new folder and run `node scripts/preview.mjs <extracted-folder>`. This is a plain static host, with no development rewrites or fallback segment aliases.

No release command pushes, publishes, or deploys. The existing Pages workflow deploys changes reaching `main`; promote only after approval. Keep the prior known-good artifact/commit for rollback and validate the live contact flow after any approved deployment. For local static hosting, extract the archive and serve the extracted root with a static server that supports directory `index.html` files.
