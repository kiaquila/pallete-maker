# ADR 0001 — Review Trigger Automation (Tier 2/3 design)

**Status:** Design only. Not adopted. Tier 1 (`pnpm run review:switch`) is the active mitigation — see `docs_pallete_maker/project/devops/review-trigger-automation.md`.

**Date:** 2026-04-18 (extracted from `review-trigger-automation.md` during docs consolidation)

**Context:** All three supported review backends reject bot-posted trigger comments. Tier 1 (manual wrapper) is live and sufficient for current volume. This ADR captures the broader automation options so a future spec can adopt one without re-researching the problem.

## Tier 2 — Local git post-push hook (semi-automatic)

A husky-managed `post-push` hook that runs locally after every `git push` to a branch with an open PR. It detects the PR number via `gh pr view --json number` and posts the appropriate trigger comment using local `gh`.

- Pros: fully automatic for local developer pushes.
- Cons: does NOT run when agents or CI push (hooks are local only); needs husky wiring.

## Tier 3 — GitHub Actions workflow with user PAT (most coverage)

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
          case "${agent:-codex}" in
            codex)  echo "trigger=@codex review"  >> "$GITHUB_OUTPUT" ;;
            gemini) echo "trigger=/gemini review" >> "$GITHUB_OUTPUT" ;;
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

Adopt Tier 1 now (active). Adopt Tier 3 when recurring friction from manual retriggers outweighs the PAT security posture review. Tier 2 is optional for developers who prefer local-only automation.
