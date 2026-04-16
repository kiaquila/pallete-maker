# 005 — Implementation Plan

## Approach

Four layers in dependency order:

1. **Prompt** — create `.github/claude/prompts/pr-review.md` with
   pallete-maker review priorities; this is pure content and has no deps.

2. **Scripts** — `run-ai-pr-review.sh` (router) and
   `run-claude-pr-review.sh` (executor); both call `resolve-pr-context.mjs`
   outputs injected as env vars from the workflow.

3. **Workflow** — split `ai-review.yml` into two jobs:
   - `ai-review` (existing, gate-based) — condition restricted to
     `gemini | codex | ''`
   - `ai-review-local` (new, self-hosted) — runs only when
     `AI_REVIEW_AGENT == 'claude'`

4. **Tooling** — `switch-review-agent.mjs` skips trigger comment for claude
   since push auto-triggers the local job.

## Risks

- Self-hosted runner must be registered and online; if offline the job queues
  silently. Document the setup and fallback (`review:switch --to gemini`).
- Diff cap (64 KB) may truncate very large PRs; acceptable trade-off.
- `claude -p` session must be authenticated; document `claude auth` as a
  prerequisite in the runner setup guide.
