# Review Contract

## Backend Trigger Constraints

All three supported review backends require a **human-authored** trigger
on `pull_request: synchronize` events. Bot-posted trigger comments from
GitHub Actions (`github-actions[bot]`) are rejected silently or with an
explicit error by every backend:

- **Gemini** — `gemini-code-assist[bot]` silently ignores bot-posted
  `/gemini review` comments; the gate times out after 20 minutes.
- **Codex** — the connector replies "trigger did not come from a
  connected human Codex account" and the `AI Review` gate fails fast.
- **Claude** — `claude-review.yml` gates on `author_association in
(OWNER, MEMBER, COLLABORATOR)` and drops anything authored by a bot.

Gemini Code Assist's on-open auto-review (on `opened` and `ready_for_review`)
covers the initial review for free, but every new push on an already-open PR
needs a manual trigger. The canonical recovery path is
`pnpm run review:switch -- --to <agent>`, which flips the repository
variable, posts the correct native trigger comment as the current `gh`
user (human-authored, therefore trusted), and reruns the most recent
failed `AI Review` job.

See `docs_pallete_maker/project/devops/ai-runner.md` for the full
backend matrix.

## Gemini Review

- Default review backend for `pallete-maker`
- Native GitHub PR review surface from `gemini-code-assist[bot]`
- Inline findings are expected to carry `Critical`, `High`, `Medium`, or `Low`
- `Low`-only findings are advisory
- `Critical`, `High`, and `Medium` findings block merge

## Codex Review

- Optional fallback review backend, used when `AI_REVIEW_AGENT=codex`
- Native GitHub PR review surface from `chatgpt-codex-connector[bot]`
- Inline findings must carry `P0` to `P3`
- `P3`-only findings are advisory
- `P0` to `P2` findings block merge
- In `trigger_mode=skip`, formal reviews with `commit_id === headSha`
  stay authoritative.
- Summary-only / setup-error comments are accepted only when they land
  after the current head's PR timeline activation event, and after the
  newest same-head human `@codex review` trigger if one exists.
- If the timeline lookup is unavailable, the gate logs a warning and
  fails closed by waiting for formal review only.

## Claude Review

- Third-tier optional review backend, used when `AI_REVIEW_AGENT=claude`
- Triggered by a human posting `@claude review once` on the PR
- Handled by the `claude-review.yml` workflow using `ANTHROPIC_API_KEY`
- Final result is a top-level comment, not a formal GitHub review state
- The comment must start with:

```text
AI_REVIEW_AGENT: claude
AI_REVIEW_SHA: <head sha>
AI_REVIEW_OUTCOME: pass|advisory|block
```

- `pass` and `advisory` are non-blocking
- `block` is merge-blocking

## Repository Focus

For `pallete-maker`, reviewers should prioritize:

- mobile palette grid reflow regressions
- LCH harmony rules correctness (checkHarmony/hueDiff logic)
- PNG export safety (html2canvas invocation, offscreen container)
- RU UI copy consistency
- build/deploy safety
- CDN supply-chain risks (chroma-js, html2canvas, Tailwind)
- maintainability risks in the static app
