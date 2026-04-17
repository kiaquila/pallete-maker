# Plan — 009-quality-hardening

## Approach

Single PR, small diffs across three concerns: workflow hygiene, gate bugs,
UI polish.

### Preflight

Add npm script that chains existing tooling. No new code. Document in
CLAUDE.md under «Важные правила» so every agent and human sees it before
touching the repo.

### Gate fixes

1. **Codex summary in skip mode** — in `ai-review-gate.mjs`, replace the
   unconditional `recentIssueComments` time filter with the same skip-mode
   asymmetry already used for formal reviews (`triggerMode === "skip" ? all : filter`).
   Duplicate the pattern for the connector-reply branch since setup
   replies describe persistent repo state, not per-SHA events.
2. **10-run cap** — switch `gh run list --limit 10` to
   `gh run list --commit <headSha> --limit 50`. Server-side SHA filter
   eliminates the need for aggressive client-side pagination.
3. **Human-trigger dedupe** — verified already present in
   `ensureTriggerComment`, no change needed (line 238-244: matches trigger
   keyword when author is not a review bot). Leaving as-is.

### Tests

Gate helpers live in an imperative CLI script that can't be imported
without executing. Extracting pure modules is out of scope. Compromise:
new `tests/ai-review-gate-regressions.test.mjs` locks the regex patterns
against observed real-world outputs AND includes anchor tests that grep
the gate source for critical structural patterns (e.g. the skip-mode
branch). Drift in the gate breaks the test without needing a full
refactor.

### UI polish

1. **Favicon** — SVG provided by user (5-segment ring). Modified: swapped
   the 5 green shades for 5 most-contrasting brights from `PM_PALETTE`
   (Scarlet, Canary, Emerald, Cobalt, Violet), added a white `<rect>`
   matte so the same SVG reads identically against any tab background.
   Generated `apple-touch-icon.png` 180×180 via `sips -s format png -Z 180`
   from the SVG. Both files at repo root.
2. **index.html meta** — add `mobile-web-app-capable` alongside the
   deprecated apple variant. Add `<link rel="icon" type="image/svg+xml">`
   and `<link rel="apple-touch-icon">`.
3. **build-static.mjs** — extend the copy step to include the two root
   asset files so `dist/` is complete.
4. **check-static-baseline** — `requiredFiles` gains `favicon.svg` and
   `apple-touch-icon.png`. HTML assertions gain link-tag presence tests.
5. **CSP** — narrow `https://cdnjs.cloudflare.com` to
   `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/`.
6. **Off-White** — change `#FAF0E6` → `#F5EADC` in `PM_PALETTE`.

## Risks

- **SVG → PNG via `sips` has limited SVG feature support.** Mitigation:
  the SVG is intentionally simple (rect + 5 circle arcs with dasharray);
  confirmed output is correct via `file apple-touch-icon.png` (180×180
  RGBA PNG). User visually approved the SVG.
- **Narrowing CSP path breaks if html2canvas CDN URL changes.** Mitigation:
  current `index.html` reference is pinned to `1.4.1` with SRI integrity
  hash (`sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H`);
  any version bump already requires coordinated CSP + SRI update.
- **Off-White hex change could surprise users with a saved palette.**
  Mitigation: existing palettes live in user's memory / exports (PNG),
  not persisted storage. No migration needed.
- **Gate regex regression tests duplicate source-of-truth.** Mitigation:
  the tests include `gateSource.includes(...)` anchors that guarantee the
  literal regex still lives in the gate script — any rename/rewrite
  surfaces as a broken test.

## Done when

- Spec 009 acceptance criteria met.
- `pnpm run preflight` passes locally.
- PR opened, all CI + Guard + OSV Scan + AI Review checks green.
- Manual browser smoke on preview shows new favicon in tab, updated
  Off-White swatch, and no new CSP violations on golden path.
