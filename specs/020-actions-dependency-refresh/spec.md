# 020 — GitHub Actions dependency refresh

## Problem

Repository workflows pin third-party actions to immutable commit SHAs.
Scheduled Dependabot updates advance those SHAs, but the repository guard
requires every workflow change to carry complete feature memory. PR #45 moves
Claude Code Action from 1.0.231 to 1.0.236 in both retained Claude workflows.

## Solution

Accept the Dependabot-proposed pinned-SHA updates without changing workflow
behavior:

- update `anthropics/claude-code-action` in the implementation and retained
  review workflows, including the PR #45 patch update to 1.0.236
- update `google/osv-scanner-action/osv-scanner-action` to v2.6.0
- keep all existing inputs, permissions, triggers, and job structure intact
- document the repository policy for pinned workflow dependency maintenance

## Acceptance criteria

- `pnpm run check:repo` passes
- `pnpm run build` still produces the static site artifact
- required GitHub checks and the Vercel preview are green
- Codex review has no unresolved blocking findings
