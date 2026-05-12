# 019 — Tasks

## Tasks

- [x] Inspect `unicorn-hub` and compare it with `pallete-maker`.
- [x] Refresh docs that mention obsolete chroma/LCH/Tailwind CDN or single-file
      architecture.
- [x] Add Unicorn Hub config and shared helpers.
- [x] Add SENAR PR/spec templates.
- [ ] Add event-driven AI Review rerun scripts and workflow.
- [ ] Add tests for new helper behavior.
- [ ] Run `pnpm run preflight`.
- [ ] Push branch and open PR.
- [ ] Trigger Codex review.

## Process Memory

- `unicorn-hub` is a process blueprint, not a UI/product source. There are no
  palette UI assets to import.
- Do not run the bootstrap script with `--force` against this repo; it would
  create competing `docs_project/` docs and risk replacing app-specific checks.
