# Dependency Updates

## Goal

Keep repository-owned development and CI dependencies current without changing
the product contract or weakening required checks.

## Requirements

- Review each dependency update independently and merge it in PR-number order.
- Preserve the static build, tests, formatting, and Vercel preview behavior.
- For major compiler updates, migrate the repository-owned build entrypoint and regenerate its committed artifact.
- Record each accepted update in the durable dependency ledger.
- Require a current-head Codex review and all required gates before merge.

## Acceptance Criteria

- `pnpm run ci` passes for the updated dependency set.
- `pnpm run build:css` succeeds and the committed Tailwind artifact uses the accepted compiler version.
- `baseline-checks`, `guard`, `AI Review`, and Vercel are green on the PR head.
- No blocking review thread remains unresolved.
