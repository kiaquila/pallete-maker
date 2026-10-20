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
  known About Codex details block may follow the verdict. The observed `Bravo.`
  presentation sign-off is accepted; unknown or contradictory prose is pending.
- Formal review edits and dismissals must re-evaluate the check. Trusted
  `ai-review-edit:v1` records supply ordering only, bound to the full head,
  selected agent, review ID and exact current body/state hash. They cannot
  manufacture a native verdict. A retracted formal verdict becomes pending;
  every same-head native P0-P2 or untagged formal body finding remains blocking.
  All submitted current-head native reviews remain candidates even after their
  verdict text is removed. On equal-second timestamps, a non-passing comment or
  formal verdict takes precedence over a passing counterpart, including ties
  between multiple formal reviews regardless of REST list order.
- Pick the freshest formal review or eligible receipt using edit timestamps;
  malformed newer evidence cannot expose an older positive comment. A receipt
  edited after the current trusted trigger may be reused even if created earlier.
- Before success, inspect all review-thread pages for unresolved native Codex
  P0–P2 or untagged findings, including older heads. New request markers never
  erase them; P3-only findings remain advisory. Re-read the PR head immediately
  before publishing success and fail if it changed or the PR closed.
- Official `codex-pull-request-review-summary` / `codex-review-state:v1` snapshots
  may supply proof only under the strict native-state contract below. A heading,
  `Completed` text or reaction alone never supplies a verdict.
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

## Strict native structured state

Modern connector replies can vary their friendly closing without changing the
review verdict. The gate therefore accepts the connector's official mutable
summary as independent proof, rather than interpreting arbitrary closing prose.
Standalone legacy replies and receipts retain their strict verdict rules.

A trusted `chatgpt-codex-connector[bot]` summary must contain exactly one supported
summary marker and one compact `codex-review-state:v1` JSON object. The closed
schema requires exactly `code_review` and `security_review`, each with exactly
`commit_sha`, `has_any_findings`, `has_unresolved_findings` and `status`. Code
review must bind the full current 40-character SHA, have status `completed`, and
both flags must be boolean `false`. Security must either have all four fields
`null`, or independently satisfy the same current-head clean condition. Duplicate
keys, unknown keys/versions, wrong types, partial security state and stale SHAs
remain pending. The matching native visible review table is required; extra or
contradictory visible text, stale commits and unknown help content fail closed.

The snapshot's `updated_at` must follow the current head activation and latest
human request boundary; an older creation can qualify only through a fresh edit.
The latest summary supersedes older clean state even when malformed, negative,
for another head or still running. A non-passing snapshot wins timestamp ties.
No timeline means no structured-state approval.

Unknown receipt closings remain pending evidence under the existing strict
receipt parser. A later strict completed-clean snapshot may supersede that
receipt; an unknown receipt arriving after a clean snapshot makes the result
pending again. On equal timestamps, non-passing evidence wins. Request a fresh
native review when the connector publishes ambiguous evidence last. This keeps
future neutral phrases independent of a positive suffix allowlist without
interpreting arbitrary prose or weakening contradictory-finding invalidation.
Malformed envelopes, extra lines, duplicate metadata, unsupported footers and
explicit negative/provisional findings retain their normal invalidating role.
Native P0–P2 findings, unresolved threads, formal retractions, abbreviated receipt
SHA resolution and final-head checks keep their existing blocking rules.
