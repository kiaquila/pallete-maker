# Tasks — 006-rollback-local-runner

- [x] T001: Delete `scripts/run-claude-pr-review.sh`
- [x] T002: Delete `scripts/run-ai-pr-review.sh`
- [x] T003: Delete `.github/claude/prompts/pr-review.md` and `.github/claude/` if empty
- [x] T004: Remove `ai-review-local` job from `.github/workflows/ai-review.yml`
- [x] T005: Update comment in `ai-review.yml` policy step (remove reference to ai-review-local and ai-runner.md)
- [x] T006: Delete `docs_pallete_maker/project/devops/ai-runner.md`
- [x] T007: Delete `docs_pallete_maker/project/devops/macos-local-runners.md`
- [x] T008: Update `CLAUDE.md` — remove `ai-runner.md` and `macos-local-runners.md` references
- [x] T009: Update `docs_pallete_maker/README.md` — remove references to deleted docs
- [x] T010: Update `docs_pallete_maker/project/devops/ai-pr-workflow.md` — Related Docs list + remove claude local-runner mentions
- [x] T011: Update `docs_pallete_maker/project/devops/review-contract.md` — Claude Review section now describes only comment-triggered cloud path via `claude-review.yml`
- [x] T012: Add `docs_pallete_maker/project/devops/review-trigger-automation.md` — document human-comment constraint + three-tier automation proposal
- [x] T013: `pnpm run build` passes locally
- [x] T014: Open PR against main
