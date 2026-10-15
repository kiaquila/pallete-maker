# Review Contract

> Audience: all agents. **Canonical source** for: per-backend review output format, severity rules, `AI_REVIEW_OUTCOME` schema. Prereq: `ai-orchestration-protocol.md` (agent routing). Sibling: `review-trigger-automation.md` (trigger mechanics).

## Backend Trigger Constraints (summary)

All three backends reject bot-posted trigger comments. A human-authored trigger is required:

- on **every new push** (`pull_request: synchronize`) for any backend, and
- on **PR open** for `codex` and `claude` — only Gemini Code Assist auto-reviews on `opened` / `ready_for_review`. With `AI_REVIEW_AGENT=codex` (current default), the initial `AI Review` run fails quickly without evidence; a human must post `@codex review <full-head-sha>` after opening the PR.

Full backend matrix and mitigation Tiers: see `review-trigger-automation.md`. Canonical recovery: `pnpm run review:switch -- --to <agent>`.

## Codex Review (current default)

- Current default review backend, used when `AI_REVIEW_AGENT=codex`
- Native GitHub PR review surface from `chatgpt-codex-connector[bot]`
- Inline findings must carry `P0` to `P3`
- `P3`-only findings are advisory
- `P0` to `P2` findings block merge, including findings published in the
  formal review body when GitHub cannot attach an inline comment. Untagged
  machine-marked body findings fail closed; a suggestions body without readable
  severity cannot be treated as an empty no-findings review.
- In `trigger_mode=skip`, formal reviews with `commit_id === headSha`
  stay authoritative.
- Summary-only / setup-error comments are accepted only when they land
  after the current head's PR timeline activation event, and after the
  newest same-head human `@codex review` trigger if one exists.
- Accept legacy `Codex Review:` no-findings replies and the native
  `<!-- codex-review-receipt:v1 -->` format from
  `chatgpt-codex-connector[bot]` only. A receipt requires exactly one positive
  verdict and one `**Reviewed commit:**` line. Match the current full SHA,
  resolving a 10–39 character abbreviation through GitHub before success.
  Reject missing/stale SHAs, duplicate markers, conflicting text and incomplete
  verdicts. Known connector sign-offs and emoji are allowed after the explicit
  no-findings sentence; unknown or contradictory prose fails closed. Only the
  known About Codex details block may follow the verdict.
- Pick the freshest formal review or eligible receipt using edit timestamps;
  malformed newer evidence cannot expose an older positive comment. A receipt
  edited after the current trusted trigger may be reused even if created earlier.
- Before success, inspect all review-thread pages for unresolved native Codex
  P0–P2 or untagged findings, including older heads. New request markers never
  erase them; P3-only findings remain advisory. Re-read the PR head immediately
  before publishing success and fail if it changed or the PR closed.
- `codex-pull-request-review-summary` / `codex-review-state:v1` comments are
  wakeup signals only. Their JSON, `Completed` text and reactions never grant
  a passing review; malformed or negative state cannot be mistaken for approval.
- If the timeline lookup is unavailable, the gate logs a warning and
  fails closed by waiting for formal review only. If review-thread proof is
  unavailable, no Codex result may pass.

## Gemini Review

- Alternative review backend, used when `AI_REVIEW_AGENT=gemini`
- Native GitHub PR review surface from `gemini-code-assist[bot]`
- Inline findings are expected to carry `Critical`, `High`, `Medium`, or `Low`
- `Low`-only findings are advisory
- `Critical`, `High`, and `Medium` findings block merge

## Claude Review (currently non-operational)

Retained for schema reference only. The `claude-review.yml` workflow is dead
code pending cleanup; `ANTHROPIC_API_KEY` is not configured and the local
runner was rolled back. Do not select `AI_REVIEW_AGENT=claude` until restored.

Schema (when operational):

- Triggered by a human posting `@claude review once` on the PR
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
