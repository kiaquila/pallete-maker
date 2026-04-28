# Spec 017 — Defense-in-Depth Checkout Assertion

## Problem

Spec 016 added a baseline assertion that the `AI Review` workflow checks out
`github.event.repository.default_branch` on its first `Checkout` step. The
current regex matches the first `- name: Checkout` block and verifies the `ref`
inside its `with:` body.

Reviewer (Claude critic, session 2026-04-27) raised a non-blocking finding on
PR #20: the assertion does not catch a scenario where a second
`actions/checkout` step is added later in the workflow. A second checkout
without `ref` (or pointed at the PR head) would overwrite the gate scripts
checked out from the trusted default branch, defeating spec 016.

## Goals

- Extend `scripts/check-static-baseline.mjs` with a second workflow assertion:
  `.github/workflows/ai-review.yml` must contain exactly one
  `actions/checkout@...` step.
- Keep the existing `ref: ${{ github.event.repository.default_branch }}`
  assertion unchanged.
- Fail `pnpm run check:repo` (and therefore `pnpm run preflight`, PR Guard, and
  CI) if a future change introduces a second checkout step in the AI Review
  workflow.

## Non-goals

- Migrate `check-static-baseline.mjs` to a YAML parser. The declarative regex
  array stays as-is.
- Change runtime behavior of the `AI Review` workflow.
- Introduce new env vars, scripts, or required files.

## Acceptance Criteria

- `scripts/check-static-baseline.mjs` `workflowAssertions` array contains a
  second entry that asserts exactly one occurrence of
  `uses: actions/checkout@` in `.github/workflows/ai-review.yml`.
- `pnpm run check:repo` passes on the current `main` (1 checkout step).
- Adding a second `actions/checkout` step to `ai-review.yml` causes
  `pnpm run check:repo` to fail with the documented message about a possible
  overwrite of gate scripts.
- Removing or replacing the only checkout step still trips the existing
  trusted-ref assertion (no regression).
