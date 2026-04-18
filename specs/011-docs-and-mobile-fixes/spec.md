# Spec 011 — Docs Refresh, Favicon Transparency, and Mobile/UI Fixes

## Problem

Several small unrelated maintenance items accumulated:

1. **README**: previous version was Russian, claimed "до 10 цветов" (wrong, actual MAX_TOTAL=15 with MAX_CHROMATIC=12), framed the project around wardrobe-capsule / Telegram WebView use cases that no longer match scope.
2. **Favicon**: had a white rect background; user wants transparent inside-and-outside (both browser favicon and apple-touch-icon).
3. **White swatch inner border**: at the picker grid, an unselected White swatch shows a 3px inner border against a 1.5px outer border — competing concentric rings instead of one unified disc edge.
4. **Mobile PNG download**: on iOS Safari the share-sheet shows an empty filename when downloading the palette. `link.download` is ignored on data URLs.
5. **Cross-pair chromatic cap**: corner case reported by the user — desaturated and dark groups are cross-compatible (24 colors total compatible), and the user perceived being able to select more than the MAX_CHROMATIC=12 cap. Pure-function `isDimmed` is correct in tests, but UI defence-in-depth was missing.

## Goals

- README is English, lean, factually accurate, with a screenshot link to the live site.
- Favicon and apple-touch-icon are fully transparent (no rect background).
- White swatch shows a 1.5px inner border when unselected, matching its outer wrapper border.
- Mobile PNG download produces a file named `palette.png` instead of an empty filename.
- `handleClick` enforces MAX_CHROMATIC and MAX_TOTAL caps explicitly, even if `isDimmed` ever leaks through.
- Behavioural test locks the cross-pair (desaturated ↔ dark) chromatic-cap invariant.
- CLAUDE.md gains a one-line commit-style rule for Claude (subject only, no body unless non-obvious why).

## Non-goals

- Rewriting the picker grid layout (the 11-column experiment was reverted; will be addressed separately later).
- Capturing or shipping the README screenshot itself (the README links to a path the user fills in).
- Touching `ai-review-gate.mjs` or any other gate logic (out of scope; spec 010 just landed).

## Acceptance criteria

- `README.md` is English, contains an image-link to `docs_pallete_maker/screenshot.png` wrapping a click-through to `https://pallete-maker.vercel.app`, has Stack / Getting started / License sections only.
- `favicon.svg` has no `<rect>` background fill; `apple-touch-icon.png` is 180×180 RGBA regenerated from the transparent SVG via `sips`.
- `index.html` `renderGrid` computes `innerWidth = isPureWhite(color) && !selected ? "1.5px" : "3px"` for the inner border.
- `index.html` `exportPalette` uses `canvas.toBlob` + `URL.createObjectURL` instead of `canvas.toDataURL`.
- `index.html` `handleClick` blocks pushes when `userPalette.length >= MAX_TOTAL` or when `!color.isAchromatic && countChromatic >= MAX_CHROMATIC`.
- `tests/harmony.test.mjs` has a regression test confirming a 12-chromatic cross-pair palette dims any further chromatic from either group while keeping all three achromatics selectable.
- `CLAUDE.md` lists the commit-style rule under «Важные правила».
- `pnpm run preflight` passes locally.
- All PR checks green on PR #14.
