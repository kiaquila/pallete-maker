# pallete-maker

## Product Summary

`pallete-maker` is a lightweight personal web app for creating and exporting color palettes. It lets a user:

- pick a base color via a color picker or hex input
- automatically generate a harmonious palette of up to 10 colors using LCH-based harmony rules (complementary, triadic, analogous, etc.)
- preview colors on a responsive grid with HEX/RGB/HSL values
- export the palette as a PNG image via html2canvas

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
3. AI review routing through repository policy with Gemini as the default reviewer
4. Vercel preview deploys on PR
5. Vercel production deploys on merge to `main`
6. repository memory through `.specify/`, `docs_pallete_maker/`, and `specs/`
7. local macOS worktree orchestration for implementation tasks

## Next Product Goal

After infra stabilization, the next implementation phase should:

- improve mobile adaptation for the palette grid
- add named palette save/load (local storage)
- improve harmony algorithm options and preview
- prepare the repo for potential migration to a modular frontend
