# AGENTS.md — pallete-maker

> Universal onboarding document for any AI agent (Claude Code, Codex, Gemini CLI, Cursor, etc.)

## What Is pallete-maker?

**pallete-maker** is a personal color palette creator. It lets a user pick a
base color, build a harmonious palette of up to **15 colors (12 chromatic + 3
achromatic; constants `MAX_TOTAL`, `MAX_CHROMATIC` in `src/scripts/harmony.mjs`)**
using LCH-based harmony rules, preview the result on a grid, and export it as a
PNG image.

**Current implementation:** static single-file web app
**Core dependencies:** chroma-js 2.4.2 (LCH harmony), html2canvas 1.4.1 (PNG export)
**Deploy target:** Vercel via Git integration
**Owner:** personal project, single user

## Current Phase & Status

| Area                                      | Status                              |
| ----------------------------------------- | ----------------------------------- |
| Product prototype                         | COMPLETE                            |
| Static palette grid + export              | COMPLETE                            |
| Mobile adaptation                         | PARTIAL — ongoing iteration         |
| Frontend architecture cleanup             | UPCOMING                            |
| Repository memory and feature-memory flow | COMPLETE                            |
| CI / AI review orchestration              | COMPLETE                            |
| Production deploy flow                    | COMPLETE via Vercel Git integration |

## Project Structure

```
pallete-maker/
├── .specify/
│   └── memory/constitution.md          # Process contract and non-negotiable rules
├── specs/
│   └── <feature-id>/                   # Feature memory: spec.md, plan.md, tasks.md
├── index.html                          # Current app shell
├── package.json                        # Repo tooling for CI, local orchestration, and build
├── vercel.json                         # Vercel build/output configuration
├── scripts/
│   ├── build-static.mjs                # Static build to dist/
│   ├── check-static-baseline.mjs       # Repository baseline checks
│   ├── check-feature-memory.mjs        # Product change -> complete specs folder enforcement
│   ├── set-implementation-agent.mjs    # Local + GitHub agent policy helper
│   ├── new-worktree.mjs                # macOS local worktree helper
│   ├── start-implementation-worker.mjs # Prompt preparation helper
│   ├── publish-branch.mjs              # Push branch and open or reuse PR
│   ├── resolve-pr-context.mjs          # Pull request context resolver for workflows
│   ├── ai-review-gate.mjs              # Review gate for Codex/Claude/Gemini
│   └── switch-review-agent.mjs         # One-shot review backend switcher (posts human trigger comment for all three agents)
├── docs_pallete_maker/
│   ├── README.md                       # Durable docs index
│   ├── adr/                            # Architecture decision records
│   ├── project-idea.md                 # Product overview and roadmap
│   └── project/
│       ├── frontend/frontend-docs.md   # Frontend architecture notes
│       └── devops/                     # CI/CD and orchestration contract
└── .github/workflows/                  # CI, guard, AI review, Claude, deploy policy
```

## Delivery Workflow

- All code changes land through pull requests.
- Product-code work starts from an active `specs/<feature-id>/` folder.
- One implementation loop uses one worktree, one branch, and one PR.
- Required GitHub checks are `baseline-checks`, `guard`, and `AI Review`.
- Vercel handles preview deployments for pull requests and production deployment for `main` through Git integration.
- Durable workflow docs live under `docs_pallete_maker/project/devops/`.
- Local orchestration state lives under `.claude/` and is gitignored.
- Local worktrees are created inside `<repoRoot>/.claude/worktrees/<slug>/` so they stay inside the repository.
- Agent selection is policy-driven through repository variables:
  - `AI_IMPLEMENTATION_AGENT`
  - `AI_REVIEW_AGENT`
- Default policy for this repository is:
  - implementation: `claude`
  - review: `codex` (switched from `gemini` on 2026-04-17; see `docs_pallete_maker/project/devops/ai-orchestration-protocol.md` for the canonical description)
- Claude is the default implementation agent because it owns architecture, orchestration, CI/CD health, and repository memory, and is driven from the user's local Claude Code terminal session.
- Codex is the current default review backend via `@codex review` triggers on PR comments.
- Gemini review stays wired via Gemini Code Assist GitHub App; switch with `pnpm run review:switch -- --to gemini`.
- Claude review workflow (`claude-review.yml`) is **currently non-operational** (dead code pending cleanup PR; no `ANTHROPIC_API_KEY` configured, local runner rolled back).

## Review Guidelines

- Gemini review uses native GitHub PR review output from `gemini-code-assist[bot]` plus inline severity markers such as `Critical`, `High`, `Medium`, and `Low`.
- Codex review uses native GitHub PR review output plus `P0-P3` inline severity badges.
- Claude review uses a top-level `claude[bot]` comment with marker lines, not a formal GitHub PR review.
- When a Claude review request includes `AI_REVIEW_AGENT`, `AI_REVIEW_SHA`, and `AI_REVIEW_OUTCOME`, preserve those lines exactly at the start of the final top-level Claude comment.
- `AI_REVIEW_OUTCOME=pass` means no material findings.
- `AI_REVIEW_OUTCOME=advisory` means advisory-only findings that should not block merge.
- `AI_REVIEW_OUTCOME=block` means at least one finding should block merge.

## Key Rules

### 1. Repository is the source of truth

No direct production edits in Vercel or the browser. Product changes must be made in git, reviewed in a PR, and deployed from the reviewed branch or merge commit.

### 2. Keep durable docs in sync

When updating `index.html`, `src/`, runtime behavior, workflows, or deploy
configuration, update the active `specs/<feature-id>/` folder and at least one
relevant durable doc under `docs_pallete_maker/`, `AGENTS.md`, or `CLAUDE.md`.

### 3. Preserve static-site deployability

Changes must keep `pnpm run build` producing a deployable `dist/index.html` artifact for Vercel.

### 4. One worker equals one worktree

Do not run parallel implementation work in the main checkout. Worktrees live
under `<repoRoot>/.claude/worktrees/<slug>/` and are created via
`scripts/new-worktree.mjs`. Local orchestration state is gitignored under
`.claude/`.

### 5. Gemini review config is repository-owned

Gemini review behavior is configured through `.gemini/config.yaml` and
`.gemini/styleguide.md`. Keep those files in sync with the repository review
contract.

### 6. Frontend changes should improve mobile, not patch around it

Avoid adding more fixed-size offsets and viewport hacks unless strictly necessary. Prefer layout systems that can survive later migration to a modular frontend app.

### 7. Propose orchestration before non-trivial tasks

Before a non-trivial task (multi-file change, refactor, research, verification loop, parallelizable work, unclear-cause debugging), propose the best-fit orchestration capability available to you in one short sentence with justification. Wait for user consent. Skip for trivial tasks (rename, one-line fix, quick question).

Claude Code specifics (OMC modes, subagents): see `CLAUDE.md § OMC orchestration`.
Codex / Gemini / other agents: propose your equivalent capabilities (planning modes, parallel runners, review councils) before starting.

### 8. Always verify active branch and target refs before answering repo-state questions

Before answering questions about repository status, PR state, review outcomes, or
workflow behavior:

- verify the current checkout branch and cleanliness (`git branch --show-current`,
  `git status --short --branch`)
- verify target refs directly (`origin/main` and the relevant PR head ref/SHA)
- do not rely on stale local branches as evidence for current repository truth

## Reading Route — Implementing a Change

This is the canonical reading order. `docs_pallete_maker/README.md` is a topical index (grouped by theme), not a reading order — defer to this list.

1. `.specify/memory/constitution.md` — non-negotiable process rules
2. `docs_pallete_maker/project-idea.md` — product facts (palette size, product state)
3. `docs_pallete_maker/project/frontend/frontend-docs.md` — frontend architecture, grid, harmony, export
4. `docs_pallete_maker/project/devops/ai-orchestration-protocol.md` — agent routing, default policy, review backends
5. `docs_pallete_maker/project/devops/ai-pr-workflow.md` — PR gates and merge rules
6. `docs_pallete_maker/project/devops/review-contract.md` — what each review backend produces
7. `docs_pallete_maker/project/devops/review-trigger-automation.md` — why bot-posted triggers are rejected, active Tier 1
8. `docs_pallete_maker/project/devops/delivery-playbook.md` — preview + production smoke
9. `docs_pallete_maker/project/devops/vercel-cd.md` — Vercel deploy contract and security headers
10. `specs/<feature-id>/spec.md`, `plan.md`, `tasks.md` — active feature
11. Relevant app files and scripts
