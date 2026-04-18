# pallete-maker

Pick from a curated 51-color palette, see which hues are harmonically compatible via LCH rules, and export your selection as PNG.

[Try it live →](https://pallete-maker.vercel.app)

<!-- screenshot: palette grid UI showing 51-color picker with harmony-compatible colors highlighted -->

## What it does

A personal color tool for designers and anyone else who wants to build a palette quickly without trial and error. You pick a base color, the app highlights which of the remaining 50 colors work with it using harmonic compatibility rules (same group or desaturated↔dark cross-pairing), then you export your final palette as a PNG. No design software required, no color theory knowledge needed.

The palette comes from a curated set: 3 achromatics (Black, Gray, White) plus 4 families (bright, pastel, desaturated, dark), each split warm and cool. Maximum selection is **15 colors (12 chromatic + 3 achromatic)**. Selected colors are grouped into Warm / Cool / Universal sections in the export.

## Getting started

Static site, no runtime beyond a browser. Build locally and open:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build          # produces dist/index.html
open dist/index.html    # or: pnpm run preflight to also run all checks
```

See [AGENTS.md](./AGENTS.md) for the full dev loop (worktrees, specs, AI review) and [`package.json`](./package.json) for all available scripts.

## Tech + architecture

Static HTML/CSS/JS, no framework or bundler. Harmony rules are pure functions in [`src/scripts/harmony.mjs`](./src/scripts/harmony.mjs), testable in isolation with no DOM dependency. UI rendering is DOM-native; Tailwind CSS is pre-compiled (not loaded from a CDN). Color math uses [chroma-js](https://gka.github.io/chroma.js/) 2.4.2; PNG export uses [html2canvas](https://html2canvas.hertzen.com/) 1.4.1. Deploys on every push to `main` via Vercel's Git integration, with preview deploys on pull requests.

Security baseline: CSP + HSTS + `X-Frame-Options` headers via `vercel.json`; Google OSV Scanner on every PR; Dependabot with a 7-day cooldown; third-party GitHub Actions pinned to commit SHAs.

UI strings are in Russian, since the primary audience speaks Russian. This README is English because the development context is international.

## Scope

Single-maintainer personal project. Not actively seeking contributions. All changes land through pull requests with required checks (baseline, guard, OSV Scan, AI Review).

## License

MIT. See [LICENSE](./LICENSE). © 2026 Kristina Aquila.
