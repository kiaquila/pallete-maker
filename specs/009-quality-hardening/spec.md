# Spec 009 — Quality Hardening: preflight, review-gate fixes, UI polish

## Problem

Several small quality gaps surfaced during PR #11 work that don't fit its
security-hardening scope:

1. **No local preflight** — product-path commits could pass local `pnpm run ci`
   but still fail PR Guard's feature-memory gate on push, because
   `check-feature-memory.mjs` is not part of `ci`. Two push-iterations were
   wasted on PR #11 for this.
2. **`scripts/ai-review-gate.mjs` — triggerTime asymmetry (codex branch)**.
   Formal reviews honour skip-mode (use all SHA-matching reviews regardless
   of triggerTime, see line 651), but the issue-comment branch used for
   Codex's "Codex Review: …" summary filters by triggerTime unconditionally.
   Consequence: Codex summary comments posted before workflow start (e.g.
   prior `workflow_dispatch` runs that succeeded, manual `@codex review`
   triggers) were ignored and the gate timed out.
3. **`scripts/switch-review-agent.mjs` — hard 10-run cap** on
   `gh run list --workflow ai-review.yml --limit 10` before filtering by SHA.
   In busy repos the latest failed AI Review for the current head can fall
   outside the first 10 runs and the rerun helper silently becomes a no-op.
4. **UI polish** —
   - no favicon for browser tab / iOS homescreen,
   - `<meta name="apple-mobile-web-app-capable">` is deprecated (Chrome
     DevTools warns; should also include `<meta name="mobile-web-app-capable">`),
   - CSP allowlist for cdnjs was domain-wide (`https://cdnjs.cloudflare.com`)
     instead of library-path scoped — Gemini's PR #11 low-priority finding,
   - Off-White (`#FAF0E6`) reads as linen rather than milky cream; user
     wants a warmer tone.

## Goals

- `pnpm run preflight` command runs feature-memory gate + full CI baseline
  locally, documented in CLAUDE.md as a required step before `git push`.
- AI review gate classifies Codex summary comments correctly in skip mode
  regardless of their creation time relative to workflow start.
- Rerun helper in `switch-review-agent.mjs` does not miss recent failed
  runs in busy repos (server-side filter by commit SHA).
- Favicon and apple-touch-icon present and declared in `index.html`.
- `mobile-web-app-capable` meta added alongside the legacy apple variant.
- CSP allowlists only the html2canvas library path on cdnjs, not the whole
  CDN.
- Off-White is milkier.
- Regression tests lock the gate regex and skip-mode asymmetry in source.

## Non-goals

- Full refactor of `ai-review-gate.mjs` into importable pure modules —
  regression tests use source-grep anchors instead (pragmatic trade-off).
- CSP `'unsafe-inline'` tightening to nonces/hashes — still the
  deferred follow-up from spec 008.
- Claude Code `PreToolUse` hook as structural guardrail option C — user
  explicitly scoped this PR to options A + B only.
- Changes to any color besides Off-White.

## Acceptance criteria

- `package.json` has `"preflight": "node scripts/check-feature-memory.mjs origin/main HEAD && pnpm run ci"`.
- `CLAUDE.md` mentions `pnpm run preflight` in the «Важные правила» section.
- `favicon.svg` and `apple-touch-icon.png` live at repo root and are listed
  in `scripts/check-static-baseline.mjs` `requiredFiles`.
- `scripts/build-static.mjs` copies both assets into `dist/` so Vercel
  serves them from the static output.
- `index.html` contains `<link rel="icon" type="image/svg+xml" href="favicon.svg">`,
  `<link rel="apple-touch-icon" href="apple-touch-icon.png">`, and
  `<meta name="mobile-web-app-capable" content="yes">` (apple variant kept
  for Safari legacy).
- `scripts/check-static-baseline.mjs` has HTML assertions for both link tags.
- `vercel.json` CSP `script-src` uses `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/`
  (path-scoped), not the whole domain.
- Off-White in `src/scripts/harmony.mjs` is `#F5EADC` (milkier).
- `scripts/ai-review-gate.mjs` codex-branch issue-comment filter mirrors
  the skip-mode asymmetry of the review branch (lines ~689-745).
- `scripts/switch-review-agent.mjs` uses `gh run list --commit <sha> --limit 50`
  instead of `--limit 10` without SHA filter.
- `tests/ai-review-gate-regressions.test.mjs` passes; full `pnpm run test`
  passes 51/51 tests (including the 13 new gate regression tests).
- `pnpm run preflight` passes locally before push.
