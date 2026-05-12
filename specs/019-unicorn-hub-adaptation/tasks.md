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
- [x] Add first-install fallback for `ai-review-rerun.yml`.
- [x] Address Codex P2 feedback about stale failed reruns after newer success.
- [x] Address Codex P1 feedback about newer evidence after existing pass.
- [x] Address local reviewer feedback (architect HIGH: drop inline rerun in
      `ai-command-policy`; code-reviewer HIGH: ignore `comment.updated_at` to
      prevent edit-spam reruns; security MEDIUM: enforce `[bot]` suffix on
      user-supplied trusted review logins).
- [ ] Trigger Codex review on the latest revision.

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
- `ai-review-rerun.yml` can fire before this PR is merged, but its trusted
  checkout points at `main`; until the script exists on `main`, it must skip
  instead of failing the PR.
- Codex flagged that rerun selection must treat the newest successful
  `AI Review` run as authoritative over older failures for the same head SHA.
- Codex then flagged the inverse edge case: if trusted review evidence is newer
  than the latest green run, rerun the gate even if that latest run succeeded.
- Local review pass surfaced three convergent risks before merge: an inline
  rerun call in `ai-command-policy.mjs` racing the event-driven flow, comment
  edits being counted as fresh evidence (and so spamming reruns), and the
  trusted review login list silently accepting non-bot accounts from
  `.unicorn-hub/config.json`. All three are fixed in this PR; the rerun path
  now has a single source of truth in `ai-review-rerun.yml`.
