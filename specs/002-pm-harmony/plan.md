# PM Harmony — implementation plan

## Scope

Replace the LCH harmony generator with a fixed 51-color palette governed by
group + temperature compatibility rules. Single-file static delivery, no
framework, no build step beyond `build-static.mjs`.

## Approach

- **Data layer:** inline `PM_PALETTE` array in `index.html` (no external JSON);
  each entry carries `hex`, `name`, and either `isAchromatic: true` or
  `{ group, temp }`.
- **Compatibility:** pure-function `isCompatible(base, target)` applies group
  rule (same group or `desaturated ↔ dark`) + temperature match; achromatics
  bypass both.
- **State:** ordered `userPalette` array; the base color is the first
  non-achromatic in the array (so an achromatic first-pick does not "lock"
  the filter).
- **UI:** reuse the existing header + main + bottom drawer shell. Picker grid
  renders all 51 swatches. Drawer shows the sorted selection (achromatics
  first, then chromatics in insertion order).
- **Export:** keep html2canvas; output file `palette.png`.

## Non-goals

- No persistence (localStorage) — ephemeral state
- No temperature-based sorting in the final palette — covered in a future spec
- No custom HEX input — picker is closed-set only

## Risks

- **Hue coverage under strict temperature filter:** a warm-group base gives
  access to only half the 12 Itten hues within its group. Tracked separately;
  may prompt an algorithm revision.
- **Visual weight of achromatics:** near-white colors (Off-white, White)
  are hard to distinguish on white background. Accepted; mitigated by the
  circle-wrapper border.

## Dependencies

- html2canvas 1.4.1 (CDN) — required for PNG export
- Tailwind CSS CDN — layout utility classes
- Inter font (Google Fonts) — typography
- chroma-js — **removed** (no longer needed)

## Verification

- `pnpm run ci` (baseline, html-validate, build, prettier) must be green
- Manual browser check: all acceptance criteria in `spec.md`
