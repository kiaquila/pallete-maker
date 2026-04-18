# pallete-maker

## Product Summary

`pallete-maker` is a lightweight personal web app for creating and exporting color palettes. It lets a user:

- browse a fixed palette of 51 curated colors and pick a base color
- automatically see which colors are compatible based on an internal harmony algorithm (group + temperature rules)
- assemble a palette of **up to 15 colors** (`MAX_TOTAL = 15`, `MAX_CHROMATIC = 12` in `src/scripts/harmony.mjs`; 12 chromatic + 3 achromatic)
- preview the selection in a bottom drawer, sorted achromatics-first
- export the palette as a PNG image via html2canvas

> This file is the canonical source of truth for product facts (palette size, composition). Other docs reference this.

## Current Product State

The current app is a strong prototype:

- the static app is deployed through Vercel-backed CI/CD
- AI orchestration and review policy follow the standard repository flow
- the palette grid renders and harmony logic works
- PNG export is functional

## Infra Goal

The repository now follows the standard delivery path:

1. PR-only changes
2. required checks in GitHub
3. AI review routing through repository policy (current default: Codex; see `project/devops/ai-orchestration-protocol.md`)
4. Vercel preview deploys on PR
5. Vercel production deploys on merge to `main`
6. repository memory through `.specify/`, `docs_pallete_maker/`, and `specs/`
7. local macOS worktree orchestration for implementation tasks

## Next Product Goal

After PM Harmony delivery, the next implementation phase may:

- add named palette save/load (local storage)
- improve mobile grid layout for the 51-color picker
- add color name search / filter
- prepare the repo for potential migration to a modular frontend
