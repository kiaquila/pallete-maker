# AGENTS.md — pallete-maker

> Universal onboarding document for any AI agent (Claude Code, Codex, Gemini CLI, Cursor, etc.)

## What Is pallete-maker?

**pallete-maker** is a personal color palette creator. It lets a user pick a
base color, build a harmonious palette of up to 10 colors using LCH-based
harmony rules, preview the result on a grid, and export it as a PNG image.

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
  - review: `gemini`
- Claude is the default implementation agent because it owns architecture, orchestration, CI/CD health, and repository memory, and is driven from the user's local Claude Code terminal session.
- Gemini is the default review backend because it runs natively on GitHub pull requests via the Gemini Code Assist GitHub App.
- Codex is available as an alternative review or implementation backend behind an explicit repository variable override.

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

Do not run parallel implementation work in the main checkout. Use the local
macOS runner flow from `docs_pallete_maker/project/devops/macos-local-runners.md`.

### 5. Gemini review config is repository-owned

Gemini review behavior is configured through `.gemini/config.yaml` and
`.gemini/styleguide.md`. Keep those files in sync with the repository review
contract.

### 6. Frontend changes should improve mobile, not patch around it

Avoid adding more fixed-size offsets and viewport hacks unless strictly necessary. Prefer layout systems that can survive later migration to a modular frontend app.

### 7. Auto-routing for orchestration capabilities

Before executing a non-trivial task, evaluate whether any orchestration capability available to you (oh-my-claudecode (OMC) modes, subagents, multi-agent council, parallel execution, verification loops, etc.) is a better fit than a single-pass implementation. If one is, **propose it to the user in one short sentence with justification before starting**. Do not auto-launch; wait for user consent.

Non-trivial triggers (any one):

- Multi-file change, refactor, or migration
- Codebase research where the answer is not obvious
- Task that benefits from a verification / QA cycle
- Parallelizable work (several independent subtasks)
- Long-running autonomous work ("don't stop until done")
- Debugging with unclear cause, tracing, or competing hypotheses

Representative modes / agents to consider (Claude Code users have OMC modes like `/plan`, `/ralph`, `/ultrawork`, `/autopilot`, `/team`, `/trace`, `/debug`, `/ask` and subagents such as `executor`, `architect`, `critic`, `code-reviewer`, `debugger`, `tracer`, `verifier`, `planner`, `security-reviewer`, `test-engineer`, `explorer`, `designer`, `writer`). Codex / Gemini / other agents should propose their equivalent capabilities (planning modes, parallel task runners, review councils, etc.) before starting non-trivial work.

Skip the proposal for trivial tasks: rename, one-line fix, simple question, quick status check. Minimal-friction principle — do not nag on small things.

## Reading Route — Implementing a Change

1. `.specify/memory/constitution.md`
2. `docs_pallete_maker/README.md`
3. `docs_pallete_maker/project-idea.md`
4. `docs_pallete_maker/project/frontend/frontend-docs.md`
5. `docs_pallete_maker/project/devops/ai-orchestration-protocol.md`
6. `docs_pallete_maker/project/devops/ai-pr-workflow.md`
7. `specs/<feature-id>/spec.md`
8. `specs/<feature-id>/plan.md`
9. `specs/<feature-id>/tasks.md`
10. Relevant app files and scripts
