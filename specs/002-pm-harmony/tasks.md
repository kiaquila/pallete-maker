# PM Harmony — tasks

## Implementation

- [x] Define `PM_PALETTE` inline with 51 colors (3 achromatic + 48 chromatic)
- [x] Tag each chromatic color with `group` and `temp`
- [x] Implement `isCompatible(base, target)`
- [x] Implement `isDimmed(color)` covering compatibility, total cap, chromatic cap
- [x] Implement `handleClick(color)` with add/remove toggling
- [x] Implement `getSortedPalette()` (achromatics first, then insertion order)
- [x] Render picker grid with 51 swatches in fixed order
- [x] Render bottom drawer with sorted palette
- [x] Wire `Скачать PNG` button to html2canvas export
- [x] Disable download button at 0 selected colors

## Cleanup

- [x] Remove chroma-js CDN link from `index.html`
- [x] Remove chroma-js baseline check in `scripts/check-static-baseline.mjs`
- [x] Remove unused LCH harmony logic

## Docs

- [x] Write `specs/002-pm-harmony/spec.md`
- [x] Write `specs/002-pm-harmony/plan.md`
- [x] Write `specs/002-pm-harmony/tasks.md` (this file)
- [x] Update `docs_pallete_maker/project-idea.md`
- [x] Update `docs_pallete_maker/project/frontend/frontend-docs.md`

## Verification

- [x] `pnpm run ci` green locally
- [ ] Guard CI green on PR (requires spec + plan + tasks co-landed)
- [ ] Manual acceptance check in browser (51 swatches visible, filtering works,
      export downloads `palette.png`)

## Follow-ups (out of scope for this PR)

- Hue coverage under the strict temperature filter — separate research thread
- Visual polish iterations (circle sizes, selection outline color, drawer
  overflow padding) — tracked as incremental commits within this PR
