# Plan — 010-gate-skip-mode-redesign

**Owner:** Codex. **Reviewer:** Claude via `oh-my-claudecode:critic`.

## Chosen design

We are implementing a **timeline-backed Codex-only skip-mode selector**.

- Formal reviews with `commit_id === headSha` stay authoritative.
- Summary/setup fallback in `trigger_mode=skip` no longer uses
  `triggerTime`, commit metadata, or Actions runs.
- The gate reads the PR timeline and finds the latest event that makes
  the current SHA the active head: `committed`,
  `head_ref_force_pushed`, or `head_ref_restored`.
- If a human posted a newer `@codex review` after that activation
  event, that trigger becomes the effective boundary.
- Only the latest Codex bot comment after the effective boundary may be
  classified as `COMMENTED_NO_FINDINGS` or `SETUP_REQUIRED`.

This closes stale prior-head summary/setup matches while still allowing
pre-dispatch reviews and same-head reruns to pass.

## Failure model

- If the PR timeline endpoint is unavailable, the gate logs a warning
  and **fails closed** by polling for formal review only.
- If the current head is not yet visible in the timeline, the gate
  keeps polling instead of falling back to weaker evidence.
- Existing `issues: write` / `pull-requests: write` workflow scopes
  already cover timeline reads, so no permission expansion is needed.

## Testability

Pure Codex helpers live in `scripts/ai-review-helpers.mjs`.

The main selector is:

- `pickAuthoritativeCodexSkipModeComment({ timelineEvents, headSha })`

Behavioural tests in `tests/ai-review-helpers.test.mjs` exercise the
spec scenarios directly instead of relying on source-string anchors.

## Rollout

1. Extract helpers and move Codex skip-mode selection into them.
2. Add behavioural tests for stale-summary, stale-setup, timeline-gap,
   and same-head re-trigger cases.
3. Update durable docs and feature memory to explain the redesign.
4. Open a Codex-authored PR and request Claude review.

## Done when

- All scenario rows from `spec.md` are represented by behavioural
  tests.
- Skip-mode summary/setup matching no longer depends on `triggerTime`,
  commit author/committer dates, or Actions runs.
- Timeline lookup is wrapped in a visible fail-closed warning path.
- Claude reviewer can audit the chosen design from this file plus the
  helper tests.
