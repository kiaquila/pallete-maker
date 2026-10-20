# Delivery Playbook

> Audience: all agents. Canonical source for: preview validation checklist, merge rule, production smoke. Prereq: `ai-pr-workflow.md`. Next: `vercel-cd.md` (deploy contract).

This playbook covers preview validation before merge and production smoke after
merge.

## Preview Checklist

For any app-facing PR, verify on the Vercel preview:

- palette grid loads without layout breakage
- base color picker works and generates palette correctly
- harmony rule selection updates the grid
- primary mobile viewport still works
- PNG export downloads a correct palette image
- no obvious missing assets or broken links appear

## Merge Rule

Do not merge while any of these are true:

- required GitHub checks are pending or failing
- the active review backend has unresolved blocking findings
- the Vercel preview is failing or visibly broken for the changed flow

## Production Smoke

After merge to `main`, verify the production URL documented in
`VERCEL_PRODUCTION_DOMAIN`. If that repository variable is unset, use the
production URL linked in the root `README.md` (currently
<https://pallete-maker.vercel.app/>).

Minimum smoke:

- palette grid loads and renders colors
- harmony logic produces correct palette for a known base color
- PNG export works on desktop and mobile

If production smoke fails, treat it as an active incident and recover through a
new PR rather than a direct Vercel dashboard edit.

## Production Smoke Results

### PR #48 — COMPLETE

Recorded on 2026-10-17 from the completed production smoke session.

- Release: [PR #48](https://github.com/kiaquila/pallete-maker/pull/48), merged on
  2026-10-15 at 23:22:52 UTC as
  `d72989a7a41b6c0c8e5bb27027329eb2f0127fa5`.
- Target: <https://pallete-maker.vercel.app/>. Vercel production deployment
  `7106811683` reported success for that merge commit.
- Test palette: Scarlet `#E82535` (Warm), Teal `#10A896` (Cool), Black `#1C1C1C`
  (Universal). The grid loaded, selecting the base color updated compatible
  choices, and the palette showed all three selected colors in their groups.

| Check             | Desktop viewport                                                                             | Mobile viewport                                     |
| ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Viewport          | 1440 × 900                                                                                   | 390 × 844                                           |
| Download          | PASS — `palette.png` saved                                                                   | PASS — repeated download saved as `palette (1).png` |
| PNG validation    | PASS — valid PNG, 1484 × 698 px, 63,220 bytes                                                | PASS — valid PNG, 1484 × 698 px, 63,220 bytes       |
| Visual inspection | PASS — all three swatches, group headings, names and HEX labels are present without clipping | PASS — same complete image                          |
| Export control    | PASS — Download PNG enabled after export                                                     | PASS — Download PNG enabled after export            |

The two downloaded PNGs are byte-for-byte identical. SHA-256 for each:
`038f351a8c8106abe342217dea3ce209a1520d030936238f4e78284e09b4ec25`.
The captured browser console contained no warnings or errors. The mobile page
width matched its 390 px viewport, and the export control remained visible.
The temporary viewport override was reset after verification.

Coverage: these checks used the in-app browser at desktop and mobile viewport
sizes. This confirms responsive layout and PNG downloads in that browser;
physical iPhone/Android devices and native mobile Safari download/share behavior
were not tested. No product changes were needed for this smoke.

Saved evidence:

- [Desktop PNG](smoke/pr-48/production-desktop-palette.png)
- [Mobile PNG](smoke/pr-48/production-mobile-palette.png)
- [Desktop screenshot](smoke/pr-48/production-desktop-smoke.jpg)
- [Mobile screenshot](smoke/pr-48/production-mobile-smoke.jpg)

The [feature task list](../../../specs/025-codex-native-review/tasks.md) records
the completed delivery milestone.
