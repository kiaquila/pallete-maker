# Review Trigger Automation

> Audience: all agents. **Canonical source** for: bot-trigger rejection matrix,
> event-driven review reruns, and the manual local wrapper. Tier 2/3 design:
> see `docs_pallete_maker/adr/0001-review-trigger-design.md`.

## Problem

All three supported review backends reject bot-posted trigger comments on `pull_request: synchronize` events:

- **Codex** — the connector replies `trigger did not come from a connected human Codex account`.
- **Gemini** — `gemini-code-assist[bot]` silently ignores bot-posted `/gemini review` comments.
- **Claude** — `claude-review.yml` gates on `author_association in (OWNER, MEMBER, COLLABORATOR)` and drops bot-authored comments.

Only Gemini Code Assist auto-reviews PRs on `opened` / `ready_for_review`. With
`AI_REVIEW_AGENT=codex` (current default) or `claude`, **even the first review
on PR open requires a human-authored trigger**. The gate runs with
`trigger_mode=skip` on `pull_request` events and validates existing same-head
native evidence. Without evidence it fails quickly, then event-driven rerun
workflows re-check the required status when trusted trigger markers or trusted
reviewer evidence appears.

## Core Insight

The backends check whether the comment's `author_association` is a human role (`OWNER`, `MEMBER`, `COLLABORATOR`) and whether the posting account is a human GitHub account — NOT whether the auth is a PAT vs GitHub App token. A fine-grained Personal Access Token (PAT) belonging to the repository owner IS treated as a human trigger.

## Event-driven rerun flow (active)

`AI Command Policy` now checks trusted human comments through
`scripts/ai-command-policy.mjs` instead of inline workflow JavaScript. For a
valid review command (`@codex review`, `/gemini review`, or
`@claude review once`) it:

1. verifies the comment author association is `OWNER`, `MEMBER`, or
   `COLLABORATOR`
2. verifies the requested backend matches `AI_REVIEW_AGENT`
3. records a hidden `unicorn-hub:ai-review-request` marker bound to the current
   PR head SHA
4. reruns the latest failed `AI Review` run for that SHA when one exists

`AI Review Rerun` listens for trusted reviewer output from the selected
backend on comment creation **and edits**. Codex legacy replies, v1 receipts,
and updates to the existing native summary all wake the gate. Summary state
is never positive evidence: the gate still requires a validated receipt or
formal review. All bot comment edits reach the default-branch runtime filter,
which authenticates the selected reviewer before routing. This includes edits
that remove every recognized marker and retract previously accepted evidence.
Comment evidence uses `updated_at`, not just `created_at`.

If the gate is active, the evidence event does not start a duplicate attempt.
An `AI Review` `workflow_run: completed` event reads current trusted evidence
and reconciles it against the latest attempt's `run_started_at`. Because REST
cannot recover an edit's previous body, completion reconciliation considers all
trusted Codex comment updates, including now-unrecognized retractions. Evidence
arriving during that attempt causes one rerun, even when the attempt's final
`updated_at` is newer than the evidence. A subsequent attempt started after
that evidence does not rerun again, including after failure. The completion
listener accepts only the PR-based `ai-review.yml` workflow, matching the
workflow file before an optional GitHub `@ref` suffix, so it cannot requeue itself. Closed PRs, old heads and concurrent pushes are ignored; the
head is refreshed again before the rerun request. When GitHub omits linked
PRs from the completion payload, resolve open exact-head PRs via the commit.

All privileged gate and rerun scripts still come from the default branch.
For the first compatibility PR, a passing native formal Codex review on its
exact head remains consumable by the old gate. A receipt-only response cannot
bootstrap the old parser: preserve the PR and report the deployment blocker
unless an existing trusted native review path succeeds. Never switch checkout
to unreviewed PR scripts, fabricate a check, weaken protection or bypass merge
checks to install the parser.

## Tier 1 — Manual local wrapper (active, zero secrets)

Canonical recovery path. Use on every push that needs a re-review:

```
pnpm run review:switch -- --to <agent>
```

The script:

1. flips the `AI_REVIEW_AGENT` repository variable if different from current
2. posts the correct native trigger comment (`@codex review`, `/gemini review`, `@claude review once`) using the local `gh` CLI auth — human-authored, therefore trusted
3. reruns the most recent failed `AI Review` job on the current PR head

A complementary `pnpm run review:retrigger` (not yet implemented) would skip step 1 for the "just rerun the current agent" case.

## Tier 2 and Tier 3 (design, not adopted)

A local post-push git hook (Tier 2) and a GitHub Actions workflow posting trigger comments via a fine-grained PAT (Tier 3) would provide broader automation coverage but introduce setup or secret-management cost. The full design and PAT security requirements are captured in:

- `docs_pallete_maker/adr/0001-review-trigger-design.md`

Adopt when recurring friction from Tier 1 outweighs the PAT security posture review.
