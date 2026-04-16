# Frontend Docs

## Current Architecture

The application is a static SPA with a modular source layout:

- `index.html` — app shell, inline CSS (`<style>`), HTML markup, and `<script type="module">` importing harmony logic
- `src/scripts/harmony.mjs` — pure ES module: palette data (`PM_PALETTE`, 51 colors) and all harmony functions (`getBase`, `isDimmed`, `isCompatible`, `getGrouped`, etc.). No DOM, no global state. Functions accept `palette` as an explicit parameter for testability.
- `src/styles/tailwind.css` — pre-compiled Tailwind CSS v3 (minified); regenerate with `pnpm run build:css` after adding new utility classes
- `src/styles/input.css` + `tailwind.config.cjs` — Tailwind build sources
- `tests/harmony.test.mjs` — 35 unit tests via `node:test` (zero extra dependencies)
- CDN dependencies: html2canvas 1.4.1 (PNG export, with SRI hash), Inter font via `@import`

## Build Pipeline

- `pnpm run build` — inlines `src/scripts/harmony.mjs` into `dist/index.html` (strips `export` keywords, replaces the `import {}` statement, converts `<script type="module">` → `<script>`), then copies `src/` to `dist/src/`
- The inlining ensures `dist/index.html` works without an HTTP server (no CORS restriction on `file://` for inline JS)
- `pnpm run build:css` — regenerates `src/styles/tailwind.css` from `index.html` classes
- `pnpm run test` — runs harmony unit tests
- `pnpm run ci` — full chain: `check:repo → check:html → build → format:check → test`
- Vercel reads `dist/` as the output directory

## Repository Memory and Feature Loop

Frontend work follows the repository memory contract:

- process rules live in `.specify/memory/constitution.md`
- durable frontend and delivery context lives in `docs_pallete_maker/`
- active implementation scope lives in `specs/<feature-id>/`

UI changes should start by updating the active feature folder before touching product code.

## Palette Picker Grid

The picker grid displays all 51 colors of the fixed palette:

- order: 3 achromatics → 12 Brights → 12 Pastels → 12 Desaturated → 12 Darks
- each swatch is a `<button>` element (88px, `--swatch-outer` CSS var) showing a color circle, name, and HEX
- dimmed (incompatible) cards carry `aria-disabled="true"` and `tabindex="-1"`
- responsive columns: 3 (mobile ≥375) → 4 (≥480) → 6 (≥640) → 8 (≥1024) → 10 (≥1280)
- color selection state is ephemeral (no persistence)
- DOM refs are cached on init in a `DOM` object; full grid rebuild on each state change

## PM Harmony Algorithm

Lives in `src/scripts/harmony.mjs`. Compatibility is determined by two attributes on each chromatic color:

- **group** (`bright` | `pastel` | `desaturated` | `dark`) — saturation/lightness tier (hard filter)
- **temp** (`warm` | `cool`) — temperature based on hue (soft; used only for final-palette sectioning)

**Rule:** two chromatic colors are compatible when they belong to the same `group`, or form the `desaturated ↔ dark` cross-pair. Temperature is **not** a filter.

**Why soft temperature:** under a strict temperature filter, cool-side bases access at most 5–6 Itten hues. Dropping the filter gives ≥12 hues per base while the warm/cool aesthetic is preserved via visual grouping.

**Achromatics** (Black `#1C1C1C`, Gray `#8C8C8C`, White `#F0F0F0`) are compatible with all 51 colors.

**Limits:** MAX_CHROMATIC = 11, MAX_TOTAL = 14, download enabled from 1 color.

**Base color:** first non-achromatic added; determines the compatibility filter. On removal of the base, the next remaining non-achromatic becomes the new base (Variant A).

## Final Palette Sectioning

The bottom drawer and PNG export use `buildColorSwatch(color, opts)` — a shared factory for visual swatch DOM nodes (outer circle, inner circle, name, hex). Caller adds sizing opts and interactivity.

Sections in drawer and PNG export:

- **Warm** — chromatic `temp === 'warm'`, insertion order
- **Cool** — chromatic `temp === 'cool'`, insertion order
- **Universal** — achromatics, sorted Black → Gray → White via `PM_INDEX` Map

Empty sections are hidden.

## Export

PNG export uses html2canvas (CDN, SRI-protected):

- an offscreen detached stage is built per-call with `buildColorSwatch` using export-size opts (130px circles)
- `document.fonts.ready` is awaited before capture to ensure Inter font is loaded
- export button shows loading state ("Экспорт...") during render; restored in `.finally()`
- `.catch()` handles failures silently; button re-enables regardless

## Accessibility

- Color card `<button>` elements have `aria-label="<name> <hex>"`
- Dimmed cards: `aria-disabled="true"`, `tabindex="-1"`, `pointer-events: none`
- Drawer toggle `<button>`: `aria-expanded`, `aria-controls="userPalette"`, `aria-label` updates on toggle
- Count span: `aria-live="polite"` for screen reader announcements
- Viewport does not restrict zoom (`user-scalable=no` removed)
