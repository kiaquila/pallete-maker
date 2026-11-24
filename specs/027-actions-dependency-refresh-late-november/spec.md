# 027 — Late-November GitHub Actions dependency refresh

## Problem

Dependabot PR #66 updates three pinned GitHub Actions dependencies, but the
repository guard requires workflow changes to include complete feature memory.
Without that record, the mechanical dependency refresh cannot pass `guard`.

## Solution

Accept the Dependabot-generated immutable SHA updates without changing workflow
behavior:

- update `anthropics/claude-code-action` in the retained implementation and
  review workflows
- update `google/osv-scanner-action/osv-scanner-action` from 2.7.0 to 2.7.1
- preserve existing triggers, permissions, inputs, and job structure
- record the maintenance intent in this feature-memory folder

## Acceptance criteria

- the workflow diff contains only the Dependabot-proposed pinned SHA updates
  plus this feature memory
- `pnpm run check:repo` passes
- `pnpm run build` produces the deployable static artifact
- required GitHub checks and the Vercel preview are green
- Codex review has no unresolved blocking findings on the final head
