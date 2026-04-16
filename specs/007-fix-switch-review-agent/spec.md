# Spec 007 — Fix switch-review-agent for Claude comment trigger

## Problem

After PR #9 removed the local self-hosted Claude runner, `scripts/switch-review-agent.mjs` still encoded `triggerBodies.claude = null` with the rationale "claude uses a self-hosted local runner that auto-triggers from push events". Running `pnpm run review:switch -- --to claude` would silently skip posting the trigger comment, leaving Claude Review un-invoked.

## Goals

- `pnpm run review:switch -- --to claude` posts `@claude review once` on the target PR.
- All three review backends (`gemini`, `codex`, `claude`) are handled uniformly — each has a human-authored trigger comment.
- Header comment in the script points to `docs_pallete_maker/project/devops/review-trigger-automation.md` for the constraint rationale.

## Non-goals

- Implementing Tier 1/2/3 automation from `review-trigger-automation.md`.
- Touching `claude-review.yml` itself (it already gates on `author_association` and works for human-posted comments).

## Acceptance criteria

- `triggerBodies.claude === "@claude review once"` in `scripts/switch-review-agent.mjs`.
- The `triggerBody === null` special case in step 2 is removed; only `--no-comment` skips posting.
- `AGENTS.md` script table note mentions the new uniform behavior.
- `pnpm run format:check`, `pnpm run check:repo`, build, tests all pass.
