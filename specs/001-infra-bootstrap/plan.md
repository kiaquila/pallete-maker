# Plan: 001-infra-bootstrap

## Approach

Port the full `dreamboard` infrastructure to `pallete-maker` with targeted
adaptations for the palette domain. No product code changes.

## Phases

1. Root config: `package.json`, `pnpm-workspace.yaml`, `vercel.json`,
   `.gitignore`, `.htmlvalidate.json`, `LICENSE`
2. Adapted scripts: `build-static.mjs` (src/ optional), `check-static-baseline.mjs`
   (chroma+html2canvas, docs paths)
3. As-is scripts: `check-feature-memory.mjs`, `set-implementation-agent.mjs`,
   `new-worktree.mjs`, `start-implementation-worker.mjs`, `publish-branch.mjs`,
   `resolve-pr-context.mjs`, `ai-review-gate.mjs`, `switch-review-agent.mjs`
4. Gemini config: `.gemini/config.yaml`, `.gemini/styleguide.md`
5. Process memory: `.specify/memory/constitution.md`
6. Agent docs: `CLAUDE.md`, `AGENTS.md`, `README.md`
7. Durable docs: `docs_pallete_maker/` (11 files)
8. Workflows: 6 GitHub Actions files
9. `pnpm install` → `pnpm run ci` passes locally
10. Commit + PR

## Key Decisions

- `src/` copy in `build-static.mjs` is conditional (forward-compat)
- CDN checks: `chroma.min.js` + `html2canvas.min.js`
- Default review: `AI_REVIEW_AGENT=gemini`
- `ANTHROPIC_API_KEY` not required as GitHub Secret
