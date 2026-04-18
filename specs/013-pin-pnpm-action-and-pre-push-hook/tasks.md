# Tasks — 013-pin-pnpm-action-and-pre-push-hook

- [x] T001: Resolve `pnpm/action-setup@v4` → annotated tag → commit SHA `b906affcce14559ad1aafd4ab0e942779e9f58b1` via `gh api`
- [x] T002: Pin `pnpm/action-setup@<sha> # v4` in `.github/workflows/ci.yml`
- [x] T003: Pin `pnpm/action-setup@<sha> # v4` in `.github/workflows/pr-guard.yml`
- [x] T004: Update `docs_pallete_maker/project/devops/vercel-cd.md` to note pnpm/action-setup is now SHA-pinned (closes the third-party-action exception)
- [x] T005: Write `.claude/hooks/check-feature-memory-on-push.sh` with stdin-JSON parsing, git-push regex, feature-memory invocation, exit-2-on-fail
- [x] T006: `chmod +x` the hook script
- [x] T007: Add `hooks.PreToolUse` block to `.claude/settings.local.json` referencing the script via `$CLAUDE_PROJECT_DIR`
- [x] T008: Smoke-test the hook with fake JSON for both push and non-push cases (both exit 0 expected here since branch has no diff yet against origin/main pre-commit)
- [x] T009: Document the hook in `CLAUDE.md` «Важные правила» (location, restore-on-clone, emergency bypass)
- [x] T010: `pnpm run preflight` passes (committed state)
- [ ] T011: Push triggers the hook itself; this PR's spec 013 satisfies the gate so push proceeds
- [ ] T012: All PR checks green (baseline-checks, guard, osv-scan, AI Review, Vercel)
- [ ] T013: Merge PR after all checks COMPLETED + SUCCESSFUL per `feedback_never_merge_before_review.md`
