# Review Trigger Automation

> Audience: all agents. **Canonical source** for: bot-trigger rejection matrix, Tier 1 (active) recovery path. Tier 2/3 design: see `docs_pallete_maker/adr/0001-review-trigger-design.md`.

## Problem

All three supported review backends reject bot-posted trigger comments on `pull_request: synchronize` events:

- **Codex** — the connector replies `trigger did not come from a connected human Codex account`.
- **Gemini** — `gemini-code-assist[bot]` silently ignores bot-posted `/gemini review` comments.
- **Claude** — `claude-review.yml` gates on `author_association in (OWNER, MEMBER, COLLABORATOR)` and drops bot-authored comments.

Gemini Code Assist auto-reviews PRs on `opened` and `ready_for_review`, which covers the first review on PR creation. Every subsequent push to an already-open PR requires a human-authored trigger.

## Core Insight

The backends check whether the comment's `author_association` is a human role (`OWNER`, `MEMBER`, `COLLABORATOR`) and whether the posting account is a human GitHub account — NOT whether the auth is a PAT vs GitHub App token. A fine-grained Personal Access Token (PAT) belonging to the repository owner IS treated as a human trigger.

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
