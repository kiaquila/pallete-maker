# Spec 010 — AI Review gate skip-mode redesign

> **Handoff context for Codex.** Claude attempted this in spec 009 and
> hit six consecutive legit Codex P1/P2 findings. The area was reverted
> to `main` state; this spec captures the full problem, the attempted
> fixes, why each failed, and the design constraints for a proper
> redesign. Claude will act as reviewer on the Codex-authored PR that
> implements spec 010.

## Problem

`scripts/ai-review-gate.mjs` runs as the last step of
`.github/workflows/ai-review.yml`. On `pull_request` events the workflow
always sets `AI_REVIEW_TRIGGER_MODE=skip` (because all three review
backends reject bot-posted trigger comments —
see `docs_pallete_maker/project/devops/review-trigger-automation.md`).

In skip mode the gate polls GitHub until it observes a terminal verdict
from the selected backend. For Codex the verdict can arrive in two
shapes:

- **Formal review** (`/repos/.../pulls/{prNumber}/reviews`) with
  `commit_id` bound to a specific SHA. This is posted when Codex finds
  inline findings with P0–P3 severity badges. The gate already handles
  this branch correctly using `commit_id === headSha` (~line 651 in
  `ai-review-gate.mjs`, skip-mode asymmetry
  `candidateReviews = triggerMode === "skip" ? reviews : recentReviews`).
- **Issue-comment summary** (`/repos/.../issues/{prNumber}/comments`)
  with body beginning `"Codex Review: ..."` and no `commit_id`,
  no SHA marker. This is posted when Codex either (a) has nothing
  to say ("Didn't find any major issues. Nice work!"), or (b) the
  connector is misconfigured ("To use Codex here, create an environment
  for this repo."). **This branch is broken.**

### The specific defect

In skip mode the issue-comment branch previously filtered by `triggerTime`
(the workflow's own start time). Two failure modes:

- **Too strict.** A valid Codex summary posted before the current
  workflow dispatched (e.g. user ran `gh run rerun`, or user posted
  `@codex review` and the workflow started only seconds later) had
  `created_at < triggerTime` → filtered out → the gate polled until
  `AI_REVIEW_WAIT_MS` (20 min) and failed with `timed out`.
- **Too loose.** If we drop the time filter entirely in skip mode,
  `matchesCodexSummaryComment` only checks
  `user.login === "chatgpt-codex-connector[bot]"` and
  `body =~ /^Codex Review:/i`. It has no SHA binding. A stale
  "Didn't find any major issues" from a previous push on the same PR
  is then picked up as the current head's outcome → false-green AI
  Review check on the fresh push.

Same class of defect applies to the connector-reply branch (matching
`"create an environment for this repo"` / `"create a codex account..."`).

## Why past attempts failed

These six iterations ran on PR #12 between 19:38 and 20:15 UTC on
2026-04-17. Every finding below was approved as legit (no
hallucinations; verified against GitHub REST docs and repo source).

### Bug v1 — filter too strict (already was this way on `main`)

**Symptom.** Summary posted before workflow dispatch → filtered out →
timeout.

**Attempted fix (PR #12 first push).** Apply skip-mode asymmetry:
`triggerMode === "skip" ? issueComments : issueComments.filter(...by triggerTime)`.
In skip mode take all issue comments regardless of time.

**Why it failed.** Introduced bug v2 on the opposite side.

### Bug v2 — filter too loose (Codex P1 #1)

**Finding verbatim:**

> On `pull_request` runs the workflow always sets `trigger_mode=skip`,
> so this branch now considers all historic issue comments. Because
> `matchesCodexSummaryComment` only checks bot login + `^Codex Review:`
> (no SHA marker), an old "Didn't find any major issues" summary from
> a previous commit can be selected here and the gate exits `pass`
> before the current head commit is actually reviewed.

**Attempted fix (commit `07fb3cc`).** Bind skip-mode to
`headCommit.committer.date || headCommit.author.date` via
`GET /repos/.../commits/{headSha}`:

```js
const candidate =
  triggerMode === "skip"
    ? issueComments.filter(
        (c) => new Date(c.created_at).getTime() >= headCommitTime,
      )
    : issueComments.filter(
        (c) => new Date(c.created_at).getTime() >= triggerTime,
      );
```

**Why it failed.** Codex P1 #3 below. Also partially introduced bug v2'
(adjacent branch, same class).

### Bug v2' — connector-reply branch (Codex P1 #2)

**Finding verbatim:**

> In `skip` mode this branch now scans all Codex issue comments, so any
> historical setup message (e.g. "create an environment for this repo")
> can be re-matched and fail the gate before a fresh review arrives…
> a repo that ever had one setup-error comment can get repeat false
> failures on new pushes when no new Codex summary exists yet.

**Attempted fix (commit `ab4b253`).** Apply the same `headCommitTime`
bind to the connector-reply branch.

**Why it failed.** Inherited bug v3 from the same committer-date source.

### Bug v3 — committer/author date is frozen (Codex P1 #3)

**Finding verbatim:**

> `headCommitTime` comes from commit metadata (author/committer date),
> which can be older than existing PR comments after
> force-push/reset/cherry-pick flows; in that case, a stale
> previous-head `Codex Review: Didn't find any major issues` comment
> still passes this filter and the gate can incorrectly return
> `COMMENTED_NO_FINDINGS` before a new review is posted for the current
> head.

**Attempted fix (commit `223fb34`).** Use `GET /actions/runs?head_sha=...`
to get the earliest workflow run for the SHA (push-time surrogate):

```js
const runsForHead = await request(
  `/repos/${owner}/${repo}/actions/runs?head_sha=${headSha}&per_page=100`,
);
const earliestRunTime = (runsForHead.workflow_runs || [])
  .map((r) => new Date(r.created_at || 0).getTime())
  .filter((t) => t > 0)
  .sort((a, b) => a - b)[0];
const headFreshnessTime = Math.max(earliestRunTime || 0, headCommitTime);
```

**Why it failed.** Bugs v4, v5, v6 cascade.

### Bug v4 — missing `actions: read` permission (Codex P1 #4)

**Finding verbatim:**

> The new `headFreshnessTime` logic now unconditionally calls the
> Actions runs API, but `ai-review.yml` only grants `contents`,
> `pull-requests`, and `issues` permissions (unspecified scopes become
> `none`). In Codex mode this call can return 403, which makes the gate
> throw and fail before it can classify any review/comment, effectively
> breaking the Codex review path.

**Attempted fix (commit `d395703`).** Add `actions: read` to
`ai-review.yml` permissions AND wrap the runs fetch in `try/catch`
with fallback to `headCommitTime` and a warning log.

**Why it failed.** The fallback on permission error itself reintroduced
bug v3 (committer-date force-push bypass). Also introduced bug v5.

### Bug v5 — pagination (Codex P2 #5)

**Finding verbatim:**

> The freshness bound is derived from a single `actions/runs` page
> (`per_page=100`), so when a head SHA has more than 100 runs (for
> example after repeated reruns/manual dispatches) `earliestRunTime`
> is computed from a truncated set. Because the API page is
> newest-first, the minimum timestamp from that page can still be newer
> than the true first run for the SHA, which makes `headFreshnessTime`
> too recent and can cause valid Codex summary/setup comments to be
> filtered out in skip mode, leading to false timeouts/failures.

**Attempted fix (commit `c2f9095`).** Walk `rel="last"` link, take
`earliest` from the oldest page.

**Why it failed.** Bug v6 below (orthogonal, was already latent).

### Bug v6 — empty runs response (Codex P1 #6, NOT fixed)

**Finding verbatim:**

> When `/actions/runs?head_sha=...` returns no runs (which can happen
> right after a push, before indexing), `headFreshnessTime` falls back
> to `headCommitTime`; for cherry-picked/reset commits that timestamp
> can be much older than the current push, so skip-mode can immediately
> match an old "Codex Review: Didn't find any major issues" comment
> from a previous head and mark the gate as passed incorrectly. This
> weakens the force-push protection the change is trying to add; if
> `earliestRunTime` is missing, the gate should keep polling (or use a
> stricter temporary bound) instead of trusting commit metadata.

**No attempted fix.** Cascade became clear — area needs redesign rather
than patch.

## What a correct solution must handle

| Scenario                                                                                          | Correct outcome                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Normal push → user posts `@codex review` after dispatch → Codex responds                          | PASS after Codex reply                                                         |
| User posts `@codex review` BEFORE workflow dispatches → Codex responds → workflow then dispatches | PASS (Codex response is still valid for this head)                             |
| Same PR, previous push has a stale Codex summary → new push → NO fresh review yet                 | Do NOT false-green on the old summary; wait until fresh evidence               |
| Force-push / reset / cherry-pick: head SHA becomes a commit authored long ago                     | Do NOT accept prior-head summary just because head commit is "newer" than it   |
| `/actions/runs?head_sha=X` returns empty (API indexing lag)                                       | Keep polling or fail explicitly; do NOT fall back to a weaker bound            |
| Workflow permissions drop `actions: read`                                                         | Graceful degradation with visible log warning; do NOT silently weaken security |
| Codex cloud environment not configured → setup-error comment                                      | Surface that as a failure, but NOT a stale one from months ago                 |

## Design constraints

- **Prefer structural evidence over heuristics.** If formal review with
  `commit_id === headSha` exists, it's authoritative — no further
  heuristics needed. The hard case is summary-only (no formal review).
- **SHA binding from comment content is impossible** for summary-only
  responses (Codex does not embed SHA in the body). Binding must come
  from an external signal.
- **Candidate external signals:**
  1. **PR Timeline API** (`/repos/.../issues/{prNumber}/timeline`) —
     look for the most recent `head_ref_force_pushed` / `committed`
     event for the current `headSha`. This is the canonical "when did
     headSha become the current head of this PR" signal. Needs
     `contents: read` (already granted) and `pull-requests: read`. API
     is paginated; spec should walk or time-bound.
  2. **`@codex review` trigger pattern** — find the most recent human
     `@codex review` comment on the PR. Codex's response must follow.
     Simpler but user-dependent. Doesn't cover force-push if user
     forgot to re-trigger.
  3. **Formal-review-only** — drop summary-comment acceptance entirely.
     Require Codex to post a formal review (even if empty-findings).
     Cleanest, but **breaks the current happy path** — Codex today
     posts only summary for the no-issues case. May be acceptable if we
     accept "gate waits for manual promotion" on no-issues cycles.
- **Permissions** must be declared explicitly in
  `.github/workflows/ai-review.yml`. Any new REST endpoint gets its
  scope added. Any API call gets a try/catch and a visible warning log.
- **Tests must cover both directions**: positive (fresh evidence →
  pass) and negative (stale prior-head evidence → NOT accepted).
  Regex anchors alone are insufficient — behavioural tests ideally
  through extracted pure helpers in a new `scripts/ai-review-helpers.mjs`
  module, imported by both the gate and the test suite. (Previous
  attempts kept the gate imperative; spec 010 should consider a minimal
  pure-helpers refactor so testing can be behavioural rather than
  source-string anchors.)

## Non-goals for spec 010

- Gemini and Claude branches of the gate. Don't touch them.
- Dedupe logic in `ensureTriggerComment` (already correct).
- The 10-run cap fix in `scripts/switch-review-agent.mjs` (landed in
  spec 009, unrelated to gate internals).
- Removing the summary-comment branch support entirely, unless that is
  the chosen design — in which case it is a goal, not a non-goal.

## Acceptance criteria

1. For every scenario in the table above, a new behavioural test
   verifies the expected outcome.
2. `scripts/ai-review-gate.mjs` skip-mode branches (summary-comment AND
   connector-reply) no longer rely on `headCommit.committer.date` as
   their only freshness signal.
3. If new REST endpoints are used, their scopes are granted in
   `.github/workflows/ai-review.yml` AND runtime calls are wrapped in
   try/catch with a log-visible fallback that does NOT weaken the
   security property the freshness bound provides.
4. `pnpm run ci` passes.
5. PR Guard, OSV Scan, and AI Review all green on the new PR.
6. Original bug v1 scenario (user posts `@codex review` before
   workflow dispatches) no longer times out.
7. None of the reverted anti-patterns reappear (enforced via new
   regression tests): unfiltered skip-mode summary matching, committer-
   date-only binding, unwrapped API calls.

## Reviewer handoff

Claude (Sonnet 4.6 / Opus 4.7) will be the primary reviewer on the
Codex-authored PR implementing spec 010. Codex drives design +
implementation; Claude does triage via
`oh-my-claudecode:critic`/`code-reviewer` and stops when all scenarios
in the table pass without introducing new regressions.
