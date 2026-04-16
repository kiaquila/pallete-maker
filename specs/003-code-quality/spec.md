# 003 — Code Quality Refactor

## Goal

Improve the maintainability, testability, and security of the pallete-maker codebase without changing any user-visible behaviour.

## Scope

- Extract pure palette logic into a testable ES module (`src/scripts/harmony.mjs`)
- Add unit tests for the harmony algorithm via `node:test`
- Replace the Tailwind play CDN (~300 KB browser compiler) with a pre-compiled CSS file
- Add SRI integrity hash to the html2canvas CDN script
- Improve accessibility: color cards as `<button>`, `aria-disabled`, `aria-expanded`, `aria-live`
- Apply CSS custom properties for header/swatch magic numbers
- Cache DOM refs; remove redundant `isDrawerOpen` global
- Add `document.fonts.ready` + loading state + `.catch()` to PNG export
- Extract `buildColorSwatch` factory to eliminate drawer/export style duplication
- Refactor `ai-review-gate.mjs`: replace 6 duplicate picker functions with generic `pickLatest`
- Replace hardcoded `check-static-baseline.mjs` content checks with declarative `htmlAssertions[]`

## Non-goals

- No user-visible feature changes
- No framework adoption (stays vanilla JS)
- No changes to harmony rules or palette data
