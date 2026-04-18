# Tasks — 011-docs-and-mobile-fixes

- [x] T001: Translate `README.md` to English, drop Russian hero, drop the "Live: deployed via Vercel" line, refresh Stack to current deps, drop Scripts / Supply chain / Repository layout / Workflow sections, keep License
- [x] T002: Add clickable screenshot link at the top of `README.md` pointing to `docs_pallete_maker/screenshot.png` and wrapping `https://pallete-maker.vercel.app`
- [x] T003: Remove `<rect>` background from `favicon.svg`
- [x] T004: Regenerate `apple-touch-icon.png` 180×180 transparent via `sips -s format png -Z 180 favicon.svg --out apple-touch-icon.png`
- [x] T005: `renderGrid` in `index.html` switches inner-border width to `1.5px` for unselected pure-white swatches
- [x] T006: `exportPalette` in `index.html` uses `canvas.toBlob` + `URL.createObjectURL` for the download anchor
- [x] T007: `handleClick` in `index.html` enforces `MAX_TOTAL` and `MAX_CHROMATIC` caps explicitly before pushing
- [x] T008: Add cross-pair (desat ↔ dark) chromatic-cap regression test to `tests/harmony.test.mjs`
- [x] T009: Add commit-style rule to `CLAUDE.md` «Важные правила»
- [x] T010: `pnpm run preflight` passes locally (59/59 tests)
- [x] T010a: Codex P3 fix — commit `docs_pallete_maker/screenshot.png` (user-provided PNG, 2988x1510)
- [x] T010b: Codex P2 fix — feature-detect `canvas.toBlob` with `toDataURL` fallback in `exportPalette`
- [x] T011: All PR #14 checks green (CI, PR Guard, OSV Scan, AI Review, Vercel)
- [ ] T012: User visually confirms white-swatch fix on mobile/desktop and iOS download filename fix
- [ ] T013: Merge PR #14 after all checks COMPLETED + SUCCESSFUL per `feedback_never_merge_before_review.md`
