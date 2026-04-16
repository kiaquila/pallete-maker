# 003 — Tasks

## Done

- [x] Refactor `index.html`: accessibility, CSS custom properties, DOM cache,
      `buildColorSwatch` factory, export loading state + `fonts.ready` + `.catch()`,
      `<script type="module">`, remove Tailwind CDN, add SRI hash to html2canvas
- [x] Create `src/scripts/harmony.mjs` with pure functions and ES module exports
- [x] Update `scripts/build-static.mjs` to inline harmony.mjs at build time
- [x] Create `tests/harmony.test.mjs` — 35 unit tests via `node:test`
- [x] Add `test` and `build:css` scripts to `package.json`; add test to CI chain
- [x] Add `src/styles/tailwind.css` (pre-compiled Tailwind v3) + config
- [x] Update `scripts/check-static-baseline.mjs` — declarative `htmlAssertions[]`
- [x] Refactor `scripts/ai-review-gate.mjs` — generic `pickLatest` helper
- [x] Update `docs_pallete_maker/project/frontend/frontend-docs.md`
