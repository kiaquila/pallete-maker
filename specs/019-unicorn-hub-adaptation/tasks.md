# 019 — Tasks

## Tasks

- [x] Inspect `unicorn-hub` and compare it with `pallete-maker`.
- [x] Refresh docs that mention obsolete chroma/LCH/Tailwind CDN or single-file
      architecture.
- [x] Add Unicorn Hub config and shared helpers.
- [x] Add SENAR PR/spec templates.
- [x] Add event-driven AI Review rerun scripts and workflow.
- [x] Add tests for new helper behavior.
- [x] Run `pnpm run preflight`.
- [x] Patch OSV-reported `fast-uri` transitive advisory and re-run preflight.
- [ ] Push branch and open PR.
- [ ] Trigger Codex review.

## Process Memory

- `unicorn-hub` is a process blueprint, not a UI/product source. There are no
  palette UI assets to import.
- Do not run the bootstrap script with `--force` against this repo; it would
  create competing `docs_project/` docs and risk replacing app-specific checks.
- First PR run exposed `fast-uri@3.1.0` through `html-validate -> ajv`; fix via
  pnpm override to a non-vulnerable `fast-uri` range rather than changing app
  code.
- `fast-uri@3.1.2` is younger than the normal 7-day release-age guard, so this
  PR adds a targeted `minimumReleaseAgeExclude` entry for `fast-uri` only.
