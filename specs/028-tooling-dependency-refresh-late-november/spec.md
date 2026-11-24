# 028 — Late-November tooling dependency refresh

## Problem

Dependabot PR #67 updates two development dependencies, but the repository
guard requires package and lockfile changes to include durable documentation
and complete feature memory. Without that record, the maintenance update cannot
pass `guard`.

## Solution

Accept the Dependabot-generated dependency and lockfile updates without changing
application behavior:

- update `html-validate` from 11.21.0 to 11.21.1
- update `prettier` from 3.9.10 to 3.10.1
- preserve the existing scripts, configuration, and runtime dependencies
- record the maintenance intent in this feature-memory folder

## Acceptance criteria

- `package.json` and `pnpm-lock.yaml` contain only the Dependabot-proposed
  version updates plus this feature memory
- `pnpm install --frozen-lockfile` succeeds
- `pnpm run ci` passes with the updated validator and formatter
- required GitHub checks and the Vercel preview are green
- Codex review has no unresolved blocking findings on the final head
