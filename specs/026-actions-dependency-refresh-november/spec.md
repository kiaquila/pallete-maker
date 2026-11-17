# 026 — November GitHub Actions dependency refresh

## Problem

Dependabot PR #64 updates two pinned GitHub Actions dependencies, but the
repository guard requires workflow changes to include a complete feature-memory
folder. Without that memory, the otherwise mechanical dependency refresh
cannot pass the required `guard` check.

## Solution

Accept the Dependabot-generated immutable SHA updates without changing workflow
behavior:

- update `pnpm/action-setup` from 6.1.0 to 6.1.1 in CI and PR Guard
- update `anthropics/claude-code-action` from 1.0.266 to 1.0.269 in the
  retained implementation and review workflows
- preserve existing triggers, permissions, inputs, and job structure
- record the maintenance intent in this feature-memory folder

## Acceptance criteria

- the workflow diff contains only the Dependabot-proposed pinned SHA updates
  plus this feature memory
- `pnpm run check:repo` passes
- `pnpm run build` produces the deployable static artifact
- required GitHub checks and the Vercel preview are green
- Codex review has no unresolved blocking findings on the final head
