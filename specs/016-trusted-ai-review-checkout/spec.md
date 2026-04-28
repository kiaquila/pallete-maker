# Spec 016 — Trusted AI Review Gate Checkout

## Problem

The `AI Review` workflow runs gate scripts that decide whether a pull request
has passed native AI review. On `pull_request` events, an unqualified
`actions/checkout` can resolve to the PR head. That lets a contributor modify
the gate script in the same PR and potentially make the required `AI Review`
check pass with untrusted logic.

Codex already reported this as a P0 in review. This PR closes the repository
side of that finding by forcing the gate job to execute scripts from the
repository default branch.

## Goals

- Make the gate-based `AI Review` job checkout
  `github.event.repository.default_branch`.
- Preserve the existing PR context resolution and native review polling
  behavior.
- Add a repository baseline assertion so the trusted checkout invariant is not
  accidentally removed later.
- Document the invariant in durable devops docs.

## Non-goals

- Redesign AI review triggering or skip-mode behavior.
- Change the selected review backend policy.
- Make this PR merge-ready despite the expected review gate failure on the fix
  PR itself.

## Acceptance Criteria

- `.github/workflows/ai-review.yml` checks out
  `ref: ${{ github.event.repository.default_branch }}` before running
  `scripts/resolve-pr-context.mjs` and `scripts/ai-review-gate.mjs`.
- `pnpm run check:repo` fails if the trusted checkout ref is missing.
- Durable devops docs explain that gate code executes from the trusted default
  branch while PR metadata still targets the reviewed head SHA.
