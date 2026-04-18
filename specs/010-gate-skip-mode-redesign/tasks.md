# Tasks — 010-gate-skip-mode-redesign

**Status:** implementation in progress.

- [x] T000: Read `spec.md`, choose the redesign, and replace the
      skeleton `plan.md` with the selected approach.
- [x] T001: Extract pure Codex helpers from
      `scripts/ai-review-gate.mjs` into
      `scripts/ai-review-helpers.mjs`.
- [x] T002: Implement the new skip-mode selector
      `pickAuthoritativeCodexSkipModeComment(...)` and call it from the
      Codex gate path only.
- [x] T003: Use PR timeline as the external freshness signal and wrap
      the runtime fetch in a visible fail-closed warning path. Existing
      workflow scopes already cover timeline reads.
- [x] T004: Add behavioural tests in
      `tests/ai-review-helpers.test.mjs` covering:
  - post-dispatch clean summary
  - pre-dispatch clean summary
  - stale prior-push summary
  - force-push / old-SHA reuse
  - missing current-head timeline evidence
  - unavailable timeline evidence
  - fresh and stale setup-error handling
- [x] T005: `pnpm run preflight` passes locally.
- [ ] T006: PR opened against `main` referencing `specs/010-*/`.
- [ ] T007: Claude review requested on the PR via a human
      `@claude review once` comment.
- [ ] T008: Follow up on Claude findings until the branch is green.
- [ ] T009: Merge.
