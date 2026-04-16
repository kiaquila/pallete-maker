# 004 — Palette Alignment And English UI

## Status

Active

## Goal

Bring all saturation groups into the same hue-order as the bright palette,
raise the chromatic selection cap to 12, fix the white swatch so it renders as
true white, and translate the runtime interface to English.

## Scope

- Increase palette limits from 11 chromatic / 14 total to 12 chromatic / 15 total
- Make achromatic White render as pure white in the picker, drawer, and export
- Reorder desaturated and dark groups so their 12 hues align one-to-one with the bright palette
- Rebuild the pastel lineup so its hue progression also aligns with the bright palette
- Translate visible UI copy and accessibility labels from Russian to English

## Non-goals

- No persistence or save/load behavior
- No framework migration
- No new export format beyond PNG

## Data Rules

The canonical hue order remains defined by the bright palette:

1. Scarlet
2. Vermillion
3. Tangerine
4. Amber
5. Canary
6. Chartreuse
7. Emerald
8. Teal
9. Cobalt
10. Indigo
11. Violet
12. Fuchsia

Every other chromatic group must follow this same 12-slot order.

### Pastels

Pastels should remain lighter counterparts of the bright palette. The revised
warm side should map as:

1. Blush → Scarlet
2. a new pastel between Peach and Apricot → Vermillion
3. Beige → Tangerine
4. Off-White → Amber
5. Primrose → Canary
6. a light chartreuse counterpart → Chartreuse

The cool half should continue the same aligned order through the green → teal →
blue → indigo → violet → fuchsia range.

### White Swatch

Achromatic White must use a true white fill (`#FFFFFF`) while still remaining
visible against the white page background via a subtle neutral outline.

## Limits

| Parameter     | Value |
| ------------- | ----- |
| MAX_CHROMATIC | 12    |
| MAX_TOTAL     | 15    |
| MIN_TO_EXPORT | 1     |

## Acceptance Criteria

- [ ] The app still renders 51 swatches total
- [ ] White is pure white, not light gray, in the picker, drawer, and export
- [ ] The bright palette order remains unchanged
- [ ] The pastel palette follows the same 12-slot hue order as the bright palette
- [ ] The desaturated palette follows the same 12-slot hue order as the bright palette
- [ ] The dark palette follows the same 12-slot hue order as the bright palette
- [ ] The user can select up to 12 chromatic colors plus up to 3 achromatics
- [ ] The drawer counter and disabled states reflect the new 15-color total cap
- [ ] All user-facing UI copy is English
- [ ] `pnpm run ci` is green
