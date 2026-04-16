# 003 — Implementation Plan

## Approach

Single atomic commit on a branch rebased from `main`. All changes verified by
`pnpm run ci` (check:repo → check:html → build → format:check → test) before push.

## Steps

1. **index.html refactor** — accessibility, CSS vars, DOM cache, `buildColorSwatch`,
   export safety, `<script type="module">`, remove Tailwind CDN, add SRI hash
2. **src/scripts/harmony.mjs** — extract pure ES module; build-static.mjs inlines
   it for `file://` compatibility in dist
3. **tests/harmony.test.mjs** — 35 tests via `node:test`; add `test` + `build:css`
   scripts to package.json; include test in CI chain
4. **check-static-baseline.mjs** — declarative `htmlAssertions[]`
5. **ai-review-gate.mjs** — generic `pickLatest` replaces 6 duplicate functions
6. **docs update** — `docs_pallete_maker/project/frontend/frontend-docs.md`

## Verification

- `pnpm run ci` green locally (35/35 tests)
- PR guard passes (specs + docs updated)
- GitHub Actions CI green
- Vercel preview deploys correctly
