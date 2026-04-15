# Frontend Docs

## Current Architecture

The current application is a static single-file frontend:

- `index.html` — full app shell, markup, styles (inline + Tailwind), and logic
- CDN dependencies: html2canvas 1.4.1 (PNG export), Tailwind CSS, Inter font

There is no `src/` directory yet. All JS/CSS lives inline in `index.html`.
Future refactor may extract them to `src/styles/` and `src/scripts/`.

## Repository Memory and Feature Loop

Frontend work follows the repository memory contract:

- process rules live in `.specify/memory/constitution.md`
- durable frontend and delivery context lives in `docs_pallete_maker/`
- active implementation scope lives in `specs/<feature-id>/`

UI changes should start by updating the active feature folder before
touching product code.

## Palette Picker Grid

The picker grid displays all 51 colors of the fixed palette:

- order: 3 achromatics → 12 Brights → 12 Pastels → 12 Desaturated → 12 Darks
- each swatch shows a color circle, the color name, and the HEX code
- responsive columns: 4 (mobile) → 6 → 8 → 10 → 13 (wide desktop)
- color selection state is ephemeral (no persistence yet)

## PM Harmony Algorithm

Compatibility is determined by two attributes on each chromatic color:

- **group** (`bright` | `pastel` | `desaturated` | `dark`) — saturation/lightness tier
- **temp** (`warm` | `cool`) — temperature based on hue (warm = red-violet → yellow; cool = yellow-green → violet; yellow-green classified as warm)

**Rule:** two chromatic colors are compatible when they share the same `temp`
AND either (a) belong to the same `group`, or (b) form the `desaturated ↔ dark` pair.

**Achromatics** (Black `#1C1C1C`, Gray `#8C8C8C`, White `#F0F0F0`) are compatible with all 51 colors.

**Limits:**

- MAX_CHROMATIC = 11 (chromatic slots)
- MAX_TOTAL = 14 (11 chromatic + up to 3 achromatic)
- Download enabled from 1 color selected

**Base color:** first color added to the palette; determines the compatibility filter.
On removal, the next remaining color (`userPalette[0]`) becomes the new base (Variant A).

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
