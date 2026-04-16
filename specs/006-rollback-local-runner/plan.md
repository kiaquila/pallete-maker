# Plan — 006-rollback-local-runner

## Approach

Pure rollback + docs. No runtime behavior changes beyond removal of the `ai-review-local` job. The default cloud gate (`ai-review` job) is unchanged and already handles `gemini` / `codex` / empty → `gemini`. The `@claude review once` path via `claude-review.yml` stays.

## Steps

1. Delete local-runner artifacts: `scripts/run-claude-pr-review.sh`, `scripts/run-ai-pr-review.sh`, `.github/claude/prompts/pr-review.md` (and empty `.github/claude/` parent).
2. Delete docs `docs_pallete_maker/project/devops/ai-runner.md` and `macos-local-runners.md`.
3. Remove `ai-review-local` job from `.github/workflows/ai-review.yml`. Update inline comment + `$GITHUB_STEP_SUMMARY` pointer to new automation doc.
4. Update `CLAUDE.md`, `docs_pallete_maker/README.md`, `ai-pr-workflow.md`, `review-contract.md` references.
5. Add `docs_pallete_maker/project/devops/review-trigger-automation.md` documenting the human-comment constraint and three-tier automation proposal.
6. Verify `pnpm run build` and `pnpm test`.
7. Open PR against `main`.

## Risks

- **Broken references:** Any leftover pointer to `ai-runner.md` or `macos-local-runners.md` would 404 in repo docs. Mitigation: grep for references after the rewrite.
- **CI regression:** Removing the job from `ai-review.yml` changes required-check surface if `main` branch protection lists `AI Review (local)` explicitly. Mitigation: `main` protection lists `AI Review` (without the "local" suffix), `baseline-checks`, `guard` — no action needed.
- **Dead code in history:** `specs/005-local-claude-runner/` and `ai-runner.md` remain reachable via git history. Acceptable — they are useful as a historical record of what was tried and why it was rolled back.

## Non-goals

- Implementing the automation proposal itself (Tier 1/2/3) — captured in the new doc, handled by a future spec when recurring friction warrants it.
- Rewriting commits in `main` to strip PR #7 entirely. The rollback is forward-only via this PR.
- Auditing other repos (`vb-influencer`, `capsule-zero`) for the same anti-pattern — out of scope.

## Done when

- All acceptance criteria from `spec.md` are met.
- PR #9 on `main` with `baseline-checks`, `guard`, and `AI Review` green.
- No merge until human review and approval.
