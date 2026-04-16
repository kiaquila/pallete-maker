# Review Trigger Automation

## Problem

All three supported review backends reject bot-posted trigger comments on `pull_request: synchronize` events:

- **Gemini** — `gemini-code-assist[bot]` silently ignores bot-posted `/gemini review` comments.
- **Codex** — the connector replies `trigger did not come from a connected human Codex account`.
- **Claude** — `claude-review.yml` gates on `author_association in (OWNER, MEMBER, COLLABORATOR)` and drops bot-authored comments.

Gemini Code Assist auto-reviews PRs on `opened` and `ready_for_review`, which covers the first review on PR creation. But every subsequent push to an already-open PR requires a human to post the trigger comment. This creates recurring friction, especially when agents (Claude Code, Codex CLI) push updates to PR branches.

## Core Insight

The backends check whether the comment's `author_association` is a human role (`OWNER`, `MEMBER`, `COLLABORATOR`) and whether the posting account is a human GitHub account — NOT whether the auth is a PAT vs GitHub App token. A fine-grained Personal Access Token (PAT) belonging to the repository owner IS treated as a human trigger.

This means automation is possible by having GitHub Actions post trigger comments using a user PAT instead of the default `github.token` (which authenticates as `github-actions[bot]`).

## Three Tiers of Automation

### Tier 1 — Manual local wrapper (baseline, zero new secrets)

Existing `pnpm run review:switch -- --to <agent>` already posts the correct trigger comment using the local `gh` CLI auth (human-authored). A complementary `pnpm run review:retrigger` that only posts the current agent's trigger comment (without flipping the variable) would cover the "just rerun the review on my latest push" case.

- Pros: no secrets; purely local; works today with minor script.
- Cons: manual invocation after every push.

### Tier 2 — Local git post-push hook (semi-automatic)

A husky-managed `post-push` hook that runs locally after every `git push` to a branch with an open PR. It detects the PR number via `gh pr view --json number` and posts the appropriate trigger comment using local `gh`.

- Pros: fully automatic for local developer pushes.
- Cons: does NOT run when agents or CI push (hooks are local only); needs husky wiring.

### Tier 3 — GitHub Actions workflow with user PAT (most coverage)

A new workflow listens on `pull_request: synchronize` and posts the trigger comment via `gh pr comment` using a repository secret containing a fine-grained PAT scoped to this repo.

Sketch:

```yaml
name: Review Trigger
on:
  pull_request:
    types: [synchronize]

jobs:
  post-trigger:
    if: >
      github.event.pull_request.head.repo.full_name == github.repository
      && github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    steps:
      - name: Resolve trigger comment for backend
        id: agent
        run: |
          agent="${{ vars.AI_REVIEW_AGENT }}"
          case "${agent:-gemini}" in
            gemini) echo "trigger=/gemini review" >> "$GITHUB_OUTPUT" ;;
            codex)  echo "trigger=@codex review"  >> "$GITHUB_OUTPUT" ;;
            claude) echo "trigger=@claude review once" >> "$GITHUB_OUTPUT" ;;
          esac
      - name: Post trigger comment as repo owner
        env:
          GH_TOKEN: ${{ secrets.USER_REVIEW_PAT }}
        run: |
          gh pr comment "${{ github.event.pull_request.number }}" \
            --body "${{ steps.agent.outputs.trigger }}" \
            --repo "${{ github.repository }}"
```

- Pros: fully automatic for any push source (human, agent, CI); no local setup required on every dev machine.
- Cons: introduces a PAT secret in the repo — must be fine-grained, scoped to `Pull requests: Write` on this single repo, and rotated annually.

## PAT Security Requirements (if adopting Tier 3)

- Fine-grained PAT, not classic token.
- Resource owner: repo owner only.
- Repository access: `kiaquila/pallete-maker` only (Selected repositories, not All).
- Permissions: `Pull requests: Write`, `Contents: Read`. Nothing else.
- Expiration: 1 year maximum. Calendar reminder for rotation.
- Store in GitHub repo secret `USER_REVIEW_PAT`. Never log or echo.
- Revoke immediately on any suspicious activity in the repo.

## Recommendation

Adopt Tier 1 now (minimal script change). Adopt Tier 3 when recurring friction from manual retriggers outweighs the PAT security posture review. Tier 2 is optional for developers who prefer local-only automation.

This is documentation of the constraint; the actual adoption of Tier 1/2/3 is out of scope for the rollback PR and will be handled by a future spec.
