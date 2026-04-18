# Plan — 011-docs-and-mobile-fixes

## Approach

Five small unrelated items, batched into one PR because each is too small to justify its own.

1. **README**: revert from the heavy "2026 marketing-style" rewrite (rejected by the user) to the original lean structure, fully translated to English. Drop Russian hero, drop the "Live: deployed via Vercel" line, refresh Stack to the actual current dependencies, drop Scripts / Supply chain / Repository layout / Workflow sections, keep License. Add a clickable screenshot link at the top.
2. **Favicon**: remove the `<rect width="64" height="64" fill="#FFFFFF" />` background from `favicon.svg`. Regenerate `apple-touch-icon.png` 180×180 with transparency preserved via `sips -s format png -Z 180`.
3. **White inner border**: add a one-line conditional in `renderGrid` that switches `innerBorderWidth` to `"1.5px"` when the swatch is `isPureWhite` and unselected. Drawer and export keep the 3px (only the picker-grid unselected case changes).
4. **Mobile download**: replace `canvas.toDataURL` + `link.href = url` with `canvas.toBlob(...)` callback that creates an object URL, fires `link.click()`, and revokes the URL. iOS Safari respects `link.download` on blob URLs.
5. **Defensive cap**: add explicit `MAX_TOTAL` and `MAX_CHROMATIC` checks in `handleClick` before `userPalette.push`. `isDimmed` already handles this in pure logic, but click-handler defence prevents any future leak.
6. **Cross-pair regression test**: extend `tests/harmony.test.mjs` `isDimmed` describe with a fixture-based assertion that a 12-color cross-pair palette (6 desat + 6 dark) dims every remaining chromatic from either group while leaving all three achromatics selectable.
7. **CLAUDE.md commit-style rule**: append one bullet to «Важные правила» reminding Claude to use subject-only commits ≤72 chars; long context goes in PR description.

## Risks

- **iOS Safari blob-URL behaviour quirks**: confirmed working in modern iOS (15+); older devices may still see a generic name. Acceptable trade-off.
- **Cross-pair behavioural test is partly redundant** with the existing `dims unselected chromatics when chromatic limit is reached` test, but it explicitly captures the user-reported corner case so future changes can't silently regress it.
- **Defensive cap in `handleClick` duplicates `isDimmed` logic**: belt-and-suspenders. Cost is two extra lines; benefit is the UI cannot exceed the cap even if dimming CSS is bypassed (e.g. on touch devices that ignore `pointer-events: none` in some niche cases).
- **README screenshot path** (`docs_pallete_maker/screenshot.png`) is referenced but the file is not yet committed. GitHub will render a broken image until the user drops the file in. Acceptable: the link itself is correct.

## Done when

- All Spec 011 acceptance criteria met.
- `pnpm run preflight` passes locally.
- All PR #14 checks green (CI, PR Guard, OSV Scan, AI Review, Vercel).
- User visually confirms the white-swatch fix on mobile/desktop and the iOS download filename fix.
