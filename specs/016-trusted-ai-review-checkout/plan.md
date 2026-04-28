# Plan — 016-trusted-ai-review-checkout

## Approach

1. Update the gate-based `AI Review` checkout step to use
   `github.event.repository.default_branch`.
2. Extend `scripts/check-static-baseline.mjs` with a workflow assertion for the
   trusted checkout ref.
3. Update the AI PR workflow documentation with the security invariant.
4. Run focused validation first, then the repository preflight.

## Risk Notes

- `workflow_dispatch` also has `github.event.repository.default_branch`, so the
  same ref expression works for manual reruns.
- The trusted checkout changes which copy of the scripts runs, not which pull
  request is reviewed. `scripts/resolve-pr-context.mjs` continues to resolve the
  PR number, head SHA, base ref, and head ref from GitHub API context.
- The fix PR may still fail `AI Review` because the currently required gate is
  the vulnerable version until this change lands on `main`.

## Done When

- `pnpm run check:repo` passes.
- `pnpm run preflight` passes locally.
- Branch is pushed and a draft PR is opened against `main`.
