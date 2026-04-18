# Spec 012 — 11-column picker grid aligned to header edges

## Problem

Wide-breakpoint (≥1280px) picker grid currently shows 10 swatches per row inside `max-width: 1200px`. The grid is centered in the viewport with large empty side margins on wide displays, and its outer edges do not align with the header content (PALETTE logo on the left, DOWNLOAD PNG button on the right).

User wants:

- one extra swatch column at the wide breakpoint (10 → 11)
- original swatch sizes preserved (`--swatch-outer: 88px`, `--swatch-inner: 72px`)
- original header sizes preserved
- grid outer edges visually aligned with the header content edges, by reducing the side margin only

## Goals

- 11 columns at the `min-width: 1280px` breakpoint, instead of 10.
- Grid outer edges align with the PALETTE logo (left) and DOWNLOAD PNG button (right), since both sit in the header's `max-w-7xl` (= `80rem` / `1280px`) inner container.
- All other breakpoints (3 / 4 / 6 / 8 columns) and CSS variables unchanged.

## Non-goals

- Changing swatch sizes, header markup, button position, or any unrelated CSS.
- Touching the drawer or export rendering.
- Editing other product files (this PR is one CSS rule change).

## Acceptance criteria

- `index.html` `@media (min-width: 1280px) { #sourceGrid { … } }` block has `grid-template-columns: repeat(11, 1fr)` and `max-width: 80rem`.
- 51-color palette renders as 11 columns × 4 rows + 7 swatches in the 5th row at viewports ≥1280px.
- Grid container width matches header `max-w-7xl` content width (1280px), so outer edges line up with logo left and DOWNLOAD PNG right.
- Swatches stay at 88px outer / 72px inner.
- All PR checks green: baseline-checks, guard, osv-scan, AI Review, Vercel.
