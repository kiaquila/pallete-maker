# 020 — Dependency maintenance

## Status

Active

## Goal

Keep pinned GitHub Actions and development dependencies current through small,
reviewed Dependabot pull requests without weakening the repository delivery
gates.

## Scope

- Accept compatible patch and minor updates proposed by Dependabot.
- Preserve immutable commit-SHA pins for third-party GitHub Actions.
- Require the normal CI, security, AI review, and merge-readiness checks.
- Record each accepted maintenance update in this feature memory.

## Current update

- PR #46 updates `anthropics/claude-code-action` from `1.0.236` to `1.0.242`
  while keeping the action pinned to an immutable commit SHA.
- PR #47 updates `html-validate` from `11.16.1` to `11.16.2` together with its
  generated lockfile dependencies.
- PR #50 updates `actions/setup-node` from `7.0.0` to `7.1.0`,
  `anthropics/claude-code-action` from `1.0.242` to `1.0.248`, and
  `google/osv-scanner-action/osv-scanner-action` from `2.6.0` to `2.7.0`,
  while keeping every action pinned to an immutable commit SHA.
- PR #51 updates `prettier` from `3.9.9` to `3.9.10` together with its
  generated lockfile entry.
- PR #57 updates `html-validate` from `11.16.2` to `11.16.4` together with its
  generated lockfile dependencies.

## Acceptance criteria

- [ ] Only the intended dependency references change.
- [ ] Repository checks pass on the current PR head.
- [ ] AI Review reports no unresolved blocking findings.
- [ ] The pull request is mergeable without bypassing branch protection.
