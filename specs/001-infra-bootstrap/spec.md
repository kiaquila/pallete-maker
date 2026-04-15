# Spec: 001-infra-bootstrap

## Summary

Bootstrap the full development infrastructure for `pallete-maker` by porting
proven patterns from the `dreamboard` repository.

## Problem

The repository currently contains only `index.html`. There is no build system,
no CI, no review orchestration, no Vercel deploy configuration, and no
repository memory. This makes future product work non-resumable and unreviewed.

## Goal

Establish the full standard delivery infrastructure so that every subsequent
product PR runs through the same CI + AI review + Vercel preview loop used
in `dreamboard`.

## Scope

- pnpm package management with supply-chain protection
- Static build pipeline (`pnpm run build` → `dist/index.html`)
- Repository baseline checks (required files, viewport meta, CDN dependencies)
- Feature memory enforcement (`check-feature-memory.mjs`)
- GitHub Actions: `baseline-checks`, `guard`, `AI Review`, `ai-command-policy`,
  `claude-agent`, `claude-review`
- Vercel Git integration configuration (`vercel.json`)
- Repository memory: `CLAUDE.md`, `AGENTS.md`, `.specify/memory/constitution.md`,
  `docs_pallete_maker/`
- Gemini Code Assist as default review backend

## Out of Scope

Product changes to `index.html` palette logic or UI are not part of this PR.

## Adaptations from dreamboard

- `build-static.mjs`: `src/` copy made conditional (pallete-maker has no `src/` yet)
- `check-static-baseline.mjs`: checks `chroma.min.js` + `html2canvas.min.js`
  instead of `fabric.min.js`
- `docs_pallete_maker/` instead of `docs_dreamboard/`
- `AI_REVIEW_AGENT=gemini` (primary), not codex
- `ANTHROPIC_API_KEY` not required — Claude runs locally
