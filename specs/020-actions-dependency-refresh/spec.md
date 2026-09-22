# 020 — GitHub Actions dependency refresh

## Problem

Repository workflows pin third-party actions to immutable commit SHAs. The
scheduled Dependabot update in PR #40 advances the Claude Code action and the
OSV scanner action, but the repository guard requires every workflow change to
carry complete feature memory.

## Solution

Accept the Dependabot-proposed pinned-SHA updates without changing workflow
behavior:

- update `anthropics/claude-code-action` in the implementation and retained
  review workflows
- update `google/osv-scanner-action/osv-scanner-action` to v2.6.0
- keep all existing inputs, permissions, triggers, and job structure intact

## Acceptance criteria

- `pnpm run check:repo` passes
- `pnpm run build` still produces the static site artifact
- required GitHub checks and the Vercel preview are green
- Codex review has no unresolved blocking findings

