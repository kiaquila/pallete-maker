# Tasks — 010-gate-skip-mode-redesign

**Status:** handoff-to-Codex. Implementation not started.

This file is intentionally left minimal. Codex replaces it with a
detailed checklist once design is chosen from `plan.md` options A–D.

- [ ] T000: Codex reads `spec.md` + `plan.md`, picks one of the
      candidate approaches (A/B/C/D), writes the chosen design into
      `plan.md` replacing the skeleton.
- [ ] T001: Extract pure helpers from `scripts/ai-review-gate.mjs`
      into `scripts/ai-review-helpers.mjs`.
- [ ] T002: Implement new `pickAuthoritativeCodexEvidence(...)` in
      helpers, called from gate skip-mode branches.
- [ ] T003: Grant any new REST scopes in
      `.github/workflows/ai-review.yml`; wrap each new API call in
      try/catch with a visible warning on failure.
- [ ] T004: Behavioural tests in `tests/ai-review-helpers.test.mjs`
      covering every scenario row from `spec.md`:
  - normal push with post-dispatch Codex summary
  - pre-dispatch Codex summary (original bug v1)
  - stale prior-push summary (bug v2)
  - force-push/cherry-pick where committer.date < prior-head summary
  - empty `/actions/runs` (or whatever external signal is used)
  - missing permission scope
  - setup-error comment surfaced correctly without stale bleed
- [ ] T005: `pnpm run preflight` passes locally.
- [ ] T006: PR opened against main referencing `specs/010-*/`.
- [ ] T007: Three consecutive AI Review runs return zero P0–P2 findings
      (empirical stability bar before merge).
- [ ] T008: Claude reviewer APPROVED via `oh-my-claudecode:critic`.
- [ ] T009: Merge.
