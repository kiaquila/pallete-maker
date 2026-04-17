# Vercel CD

## Deploy Model

This repository uses **Vercel Git integration** as the canonical CD layer.

- Pull requests create Vercel preview deployments
- Merge to `main` creates a Vercel production deployment
- GitHub Actions remain the canonical CI and AI-review layer

## Connected Project

Current Vercel project:

- name: `pallete-maker`
- team: `ks_aquila's projects`

## Build Contract

The repository declares:

- `buildCommand`: `pnpm run build`
- `outputDirectory`: `dist`

`pnpm run build` must always produce a deployable static artifact under `dist/`.

Vercel auto-detects pnpm from `pnpm-lock.yaml` and uses the version pinned in `packageManager`. No Vercel dashboard overrides required.

The repository also keeps Gemini review configuration in `.gemini/` so review behavior stays versioned together with the app and workflow contract.

## Operational Rule

Do not treat manual dashboard edits as the delivery path. Product behavior should change through:

1. repository change
2. PR checks
3. merge to `main`
4. Vercel production deploy from the merged commit

Preview validation and post-merge smoke are documented in
`docs_pallete_maker/project/devops/delivery-playbook.md`.

## Security Headers

`vercel.json` sets response headers for every path as a baseline hardening
layer for the static site:

- **Content-Security-Policy** — `default-src 'self'`; explicit allowlist for
  `cdnjs.cloudflare.com` (html2canvas) and Google Fonts
  (`fonts.googleapis.com` CSS + `fonts.gstatic.com` WOFF). Any additional
  external origin added to `index.html` must be added here in the same PR,
  otherwise the browser will block it.
- **Strict-Transport-Security** — HSTS with `max-age=63072000; includeSubDomains; preload`.
- **X-Frame-Options: DENY** and `frame-ancestors 'none'` in CSP — blocks
  embedding in third-party iframes (anti-clickjacking).
- **X-Content-Type-Options: nosniff**, **Referrer-Policy**, **Permissions-Policy** —
  standard defense-in-depth defaults.

Inline scripts and styles currently require `'unsafe-inline'` in the CSP
because the build inlines `src/scripts/harmony.mjs` into `dist/index.html`
and the styles live in `<style>` tags. Tightening this to nonces or hashes
is a future improvement.

## Supply-chain Hygiene

- **OSV Scanner** (`.github/workflows/osv-scan.yml`) runs on every PR, push
  to `main`, and weekly on schedule. It checks `pnpm-lock.yaml` against
  Google's Open Source Vulnerabilities database and fails the check on any
  known CVE. Broader coverage than `npm audit`.
- **Dependabot** (`.github/dependabot.yml`) opens weekly update PRs for
  `github-actions` and `npm` ecosystems with a 7-day cooldown on new
  releases (14 days for major bumps, 3 for patches). The cooldown protects
  against freshly compromised releases.
- **Pinned action SHAs** — third-party GitHub Actions are pinned to a
  commit SHA with a trailing `# v<tag>` comment (see
  `anthropics/claude-code-action`, `google/osv-scanner-action`). Moving
  tags like `@v1` can be force-pushed to a different commit; a SHA cannot.
  Official `actions/*` are pinned to major tags for readability.
