# Plan — 012-grid-11-cols

## Approach

Two-line change in the `@media (min-width: 1280px)` block of `index.html`:

```css
@media (min-width: 1280px) {
  #sourceGrid {
    grid-template-columns: repeat(11, 1fr);
    max-width: 80rem;
  }
}
```

By matching `max-width: 80rem` to the header inner container's `max-w-7xl`, the grid sits in the same horizontal range as the header content. Both use the same `padding: 20px` on their parent (`header { padding: 20px }` and `main { padding: 20px }`), so the alignment is automatic.

Math: 1280px container - 10 gaps × 12px = 1160px / 11 = ~105px column width. 88px swatch centered with ~8.5px each side. Visually similar density to the original 10-col-in-1200 layout, just with one more column.

## Risks

- Mobile breakpoints unchanged, so the change only affects ≥1280px viewports. No mobile regression.
- Swatch CSS variables untouched, so no spillover into the drawer or export rendering.
- `max-w-7xl` Tailwind class is stable (= 80rem since v2). Future Tailwind upgrade unlikely to change this.

## Done when

- Spec 012 acceptance criteria met.
- All PR #15 checks green.
- Visual eye-check on Vercel preview confirms alignment.
