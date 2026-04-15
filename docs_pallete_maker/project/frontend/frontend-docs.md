# Frontend Docs

## Current Architecture

The current application is a static single-file frontend:

- `index.html` — full app shell, markup, styles (inline + Tailwind), and logic
- CDN dependencies: chroma-js 2.4.2 (harmony), html2canvas 1.4.1 (PNG export), Tailwind CSS, Inter font

There is no `src/` directory yet. All JS/CSS lives inline in `index.html`.
Future refactor may extract them to `src/styles/` and `src/scripts/`.

## Repository Memory and Feature Loop

Frontend work follows the repository memory contract:

- process rules live in `.specify/memory/constitution.md`
- durable frontend and delivery context lives in `docs_pallete_maker/`
- active implementation scope lives in `specs/<feature-id>/`

UI changes should start by updating the active feature folder before
touching product code.

## Palette Grid

The palette grid displays up to 10 color swatches:

- each swatch shows the color, HEX, and optional RGB/HSL values
- the grid adapts to mobile with a column layout
- color selection state is ephemeral (no persistence yet)

## Harmony Logic

Color harmony is computed with chroma-js LCH:

- base color is selected by the user via color picker or hex input
- harmony rules (complementary, triadic, analogous, split-complementary, etc.) generate additional hues
- LCH lightness and chroma are preserved from the base color across the palette
- `checkHarmony` / `hueDiff` logic enforces minimum perceptual distance between swatches

## Export

PNG export uses html2canvas:

- an offscreen container is rendered with the palette grid
- html2canvas captures it and triggers a PNG download
- export safety: never block the main thread; use a clone of the palette DOM node

## Build Contract

- `pnpm run build` copies `index.html` to `dist/index.html`
- If `src/` exists, it is also copied to `dist/src/`
- Vercel reads `dist/` as the output directory
- `pnpm run ci` validates repo baseline, HTML, formatting, and build output

## Planned Refactor Direction

The recommended target architecture for the next phase:

- extract CSS to `src/styles/app.css`
- extract JS to `src/scripts/app.js` and `src/scripts/harmony.js`
- keep the static deploy model — no framework required
- stronger mobile palette grid layout using CSS grid / container queries
