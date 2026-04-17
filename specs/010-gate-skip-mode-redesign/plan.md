# Plan — 010-gate-skip-mode-redesign

**Owner:** Codex. **Reviewer:** Claude via `oh-my-claudecode:critic`.

This file is a skeleton. Codex to replace with chosen design after
studying `spec.md` (which contains the full iteration history).

## Candidate approaches (to evaluate)

### A. PR Timeline API as freshness source

Use `/repos/.../issues/{prNumber}/timeline` to find the latest
`head_ref_force_pushed` or `committed` event for `headSha`. Bind skip-
mode matching to that event's `created_at`.

**Pros:** canonical, covers force-push/cherry-pick/reset unambiguously.

**Cons:** timeline can be paginated; extra scope (`pull-requests: read`
— already granted). Two-call overhead like actions/runs, but semantics
are tighter.

### B. Trigger-pattern anchoring

Take the most recent human `@codex review` comment on the PR. Any
Codex response must follow it. Summary with `created_at > latestTrigger`
is fresh; earlier ones are stale by definition.

**Pros:** no new API calls beyond the existing
`listPaginated(buildIssueCommentsPath(...))`.

**Cons:** user-dependent; force-push without re-trigger → gate might
accept stale summary whose body happens to post-date the earlier
trigger.

### C. Formal-review-only policy

Remove the summary-only acceptance path. Codex must always post a
formal review (empty body + no findings is still a review). Fail
loudly if only a summary appears without a formal counterpart.

**Pros:** cleanest; single source of truth (commit_id on formal
review); no heuristic binding needed.

**Cons:** Codex today posts only a summary for no-issues case. Requires
Codex Connector behaviour change OR we accept a permanent manual
promotion step on clean PRs. Verify actual Codex behaviour before
committing to this path.

### D. Hybrid A+C

Formal review when present is authoritative (already works). Summary-
only fallback gated by timeline API. Graceful fallbacks at each step.

**Recommended starting point** unless investigation shows C is cheap.

## Testability

Extract pure helpers to `scripts/ai-review-helpers.mjs`:

- `classifyCodexSummaryComment(comment)` — already a pure function,
  move as-is.
- `matchesCodexSummaryComment(comment)` — ditto.
- `classifyCodexSetupReply(comment)` — ditto.
- `pickAuthoritativeCodexEvidence({reviews, comments, timelineEvents, headSha, triggerTime, triggerMode})` — the new
  decision function. Takes all gathered data, returns
  `{outcome, reason, matchedRef}` without side effects. Gate imports
  and calls it; tests drive it with fixtures.

Behavioural tests go in `tests/ai-review-helpers.test.mjs` covering
every scenario row from `spec.md`.

## Rollout

1. Claude-authored revert of spec 009's gate changes is already merged
   as part of spec 009 (see tasks.md note). Baseline is main.
2. Codex opens a PR against main following this spec.
3. Claude reviews via `oh-my-claudecode:critic`, triages findings,
   applies fixes OR defers if out of scope.
4. After all scenarios pass + 3+ non-flaky AI Review cycles,
   merge.

## Done when

- All seven rows of the `spec.md` scenario table verified by tests.
- Zero Codex P0–P2 findings on three consecutive runs.
- Claude reviewer APPROVED.
