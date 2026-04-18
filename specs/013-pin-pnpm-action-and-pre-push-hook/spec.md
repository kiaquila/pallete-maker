# Spec 013 — Pin pnpm/action-setup to SHA + Local Pre-Push Feature-Memory Hook

## Problem

1. **README accuracy / supply-chain hygiene gap.** The merged PR #14 README (and current `docs_pallete_maker/project/devops/vercel-cd.md`) claim third-party GitHub Actions are pinned to commit SHA. Codex P3 finding on PR #14 correctly pointed out that `pnpm/action-setup@v4` in `.github/workflows/ci.yml` and `pr-guard.yml` is still a floating tag, not a SHA. The claim is therefore inaccurate AND the action is the only third-party action in the repo without SHA pinning.

2. **Recurring spec-folder forgetting.** Across PRs #11, #12, #13, #14, and #15, Claude (the implementation agent) forgot to add the `specs/<NNN-slug>/` folder before pushing five times in a row, despite the existing memory rule and the `pnpm run preflight` script. The root cause is documented in `feedback_guard_feature_memory.md`: `preflight` only checks committed state, so running it before commit (the natural reflex) misses the issue.

## Goals

- `pnpm/action-setup` is pinned to a commit SHA in both `.github/workflows/ci.yml` and `.github/workflows/pr-guard.yml`, with a trailing `# v4` comment for readability.
- README's SHA-pinning claim is accurate after this PR (no exceptions remaining among third-party actions).
- A local Claude Code `PreToolUse` hook on `Bash` matching `git push` runs `node scripts/check-feature-memory.mjs origin/main HEAD` and blocks the push (exit 2) when product-path commits lack a `specs/<id>/` folder. Hook lives in `.claude/` (gitignored, machine-local).
- CLAUDE.md documents the hook (where it lives, how to restore on another device, how to bypass for true emergencies).

## Non-goals

- Pinning `actions/*` (first-party GitHub-published actions); they remain on major tags per existing project policy.
- Touching the docs-coverage step asymmetry in the guard (specs/ accepted by feature-memory but not by docs-coverage). Tracked separately.
- Fixing PR #14's stale README sentence about SHA-pinning by editing the README; this PR makes the claim true by pinning the missing action.

## Acceptance criteria

- `.github/workflows/ci.yml` line for pnpm uses `pnpm/action-setup@<commit-sha> # v4` (SHA: `b906affcce14559ad1aafd4ab0e942779e9f58b1`).
- `.github/workflows/pr-guard.yml` line for pnpm uses the same `@<sha> # v4` form.
- `.claude/hooks/check-feature-memory-on-push.sh` exists, is executable, parses Claude Code's stdin JSON, matches `git push` commands, runs the feature-memory check, exits 2 with a helpful message on failure, exits 0 otherwise.
- `.claude/settings.local.json` has a `hooks.PreToolUse` entry registering the script for `Bash`-matched calls.
- `CLAUDE.md` mentions the pre-push hook, where it lives, and how to bypass.
- `pnpm run preflight` passes locally (committed state).
- Hook passes the smoke test on this very PR (the spec folder is present, so push proceeds; if the spec were missing, push would block).
- All PR checks green.
