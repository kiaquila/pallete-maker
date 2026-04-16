# 005 — Local Claude Runner for AI Review

## Status

Active

## Goal

Replace the gate-based Claude App review path with a self-hosted macOS runner
that calls the Claude CLI directly. Reviews trigger automatically on every
`pull_request` push without requiring a human-authored `@claude review once`
comment or an `ANTHROPIC_API_KEY` secret.

## Scope

- Add `ai-review-local` job to `ai-review.yml` that runs on
  `[self-hosted, macOS, ai-runner]` when `AI_REVIEW_AGENT=claude`
- Restrict the existing gate-based `ai-review` job to gemini and codex only
- Create `scripts/run-ai-pr-review.sh` (router) and
  `scripts/run-claude-pr-review.sh` (executor)
- Create `.github/claude/prompts/pr-review.md` (versioned review prompt)
- Update `scripts/switch-review-agent.mjs` — no trigger comment for claude
- Update `docs_pallete_maker/project/devops/ai-runner.md`

## Non-goals

- Setting up the self-hosted runner daemon itself (documented separately in
  `docs_pallete_maker/project/devops/macos-local-runners.md`)
- Changing gemini or codex review paths
- Changing the implementation agent selection

## Architecture

```
AI_REVIEW_AGENT=claude
  └─► ai-review-local job (self-hosted, macOS, ai-runner)
        └─► scripts/run-ai-pr-review.sh
              └─► scripts/run-claude-pr-review.sh
                    └─► claude -p < prompt → gh pr comment

AI_REVIEW_AGENT=gemini | codex | (unset → gemini)
  └─► ai-review job (ubuntu-latest) — unchanged
        └─► scripts/ai-review-gate.mjs
```

## Acceptance Criteria

- [ ] Push to a PR with `AI_REVIEW_AGENT=claude` triggers `ai-review-local` on
      the self-hosted runner without any human comment
- [ ] The review appears as a PR comment within the job timeout (15 min)
- [ ] Push to a PR with `AI_REVIEW_AGENT=gemini` still uses the gate path unchanged
- [ ] `pnpm run review:switch -- --to claude` no longer posts a trigger comment
- [ ] `pnpm run ci` stays green
