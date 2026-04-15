# macOS Local Runners

This document adapts the local worker orchestration pattern to macOS for
`pallete-maker`.

## Purpose

Local runners are not GitHub self-hosted runners. They are the repository-owned
macOS helpers for:

- selecting implementation and review policy
- creating isolated worktrees
- preparing high-signal implementation prompts
- publishing the active branch to a draft PR

## Rules

- One task equals one worktree, one branch, and one PR.
- Never run multiple implementation loops inside the main checkout.
- Start each worktree from current `main`.
- Keep worktrees inside the repository at
  `<repoRoot>/.claude/worktrees/<slug>/` so they do not pollute the user's
  `~/projects/` directory.
- Keep prompts tied to one active `specs/<feature-id>/` folder.
- Use the scripts to prepare and publish work, but never bypass GitHub checks.

## Prerequisites

- macOS with `git`, `gh`, and Node.js 20+ available
- authenticated GitHub CLI for repository variable updates and PR creation
- Claude Code available locally as the primary implementation agent

## Local State

The scripts keep local orchestration state in `.claude/`:

- `.claude/implementation-agent`
- `.claude/review-agent`
- `.claude/prompts/`
- `.claude/worktrees/`

This directory is local-only and gitignored.

## Recommended Flow

1. Select policy.

```bash
node scripts/set-implementation-agent.mjs --implementation claude --review gemini
```

2. Create a new isolated worktree inside `.claude/worktrees/`.

```bash
node scripts/new-worktree.mjs --feature 002-mobile-grid
```

3. Change into the created worktree.

4. Generate the implementation prompt and copy it to the clipboard.

```bash
node scripts/start-implementation-worker.mjs \
  --feature 002-mobile-grid \
  --copy
```

5. Run Claude Code using that prompt.

6. Publish the branch and open or reuse a draft PR.

```bash
node scripts/publish-branch.mjs \
  --feature 002-mobile-grid \
  --title "feat: improve mobile palette grid layout"
```

## Fallback Review Agent

When the selected review backend stalls or returns unexpected output on an open
PR, you can flip the policy and re-trigger the `AI Review` gate with a single
command from the current worktree:

```bash
pnpm run review:switch -- --to codex
```

The helper resolves the open PR for the current branch, flips the
`AI_REVIEW_AGENT` repository variable via `gh variable set`, posts the
correct native trigger comment on the PR (`/gemini review`, `@codex review`,
or `@claude review once`), and reruns the most recent failed `AI Review` run
on the current head SHA.

Optional flags:

- `--pr <number>` — target a specific PR instead of the current branch
- `--no-rerun` — flip and comment without rerunning
- `--no-comment` — flip and rerun without posting a trigger comment
- `--repo <owner/name>` — target a different repository

## Trade-Offs

- The repository prepares prompts and branch/worktree state, but it does not
  force-launch a specific local app.
- Codex implementation and Claude review remain optional paths behind an
  explicit override.
