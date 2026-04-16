# 004 — Implementation Plan

## Approach

Keep the architecture unchanged and solve the task in four focused layers:

1. **Palette data** — update `PM_PALETTE`, limits, hue ordering, and white swatch semantics in `src/scripts/harmony.mjs`
2. **Runtime UI** — translate visible strings and ensure white swatches stay legible in `index.html`
3. **Verification** — expand unit tests so ordering, counts, and white behavior are asserted in code
4. **Docs** — sync frontend docs with the new ordering contract and English UI

## Risks

- Pastel hue alignment is partly aesthetic, so the updated color choices should stay close to the user's described mapping rather than blindly preserving existing names
- Pure white can disappear on a white background if the swatch outline logic is not shared between grid, drawer, and export
- Reordering chromatic groups may subtly change warm/cool section membership, so tests should pin the intended mapping

## Verification

- `pnpm run ci`
- Manual smoke check in preview PR: white swatch visibility, 15-item counter, aligned hue order, English copy
