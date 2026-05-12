# 019 — Unicorn Hub adaptation

## Goal

Selectively adopt the useful parts of `kiaquila/unicorn-hub` into
`pallete-maker` without replacing the existing app-specific documentation,
security checks, or static deploy flow.

## Scope

- Add a repository-local Unicorn Hub profile/config layer for paths, checks, and
  defaults.
- Add SENAR-oriented PR/spec templates so future changes capture acceptance
  evidence, negative scenarios, and process memory consistently.
- Add event-driven AI Review rerun support so trusted review triggers and
  reviewer evidence can re-check the required `AI Review` status without a long
  polling window.
- Refresh durable docs that still describe the old single-file/chroma/Tailwind
  CDN implementation.

## Out Of Scope

- No product UI changes.
- No migration to `docs_project/`; `docs_pallete_maker/` remains canonical.
- No generic replacement of `scripts/check-static-baseline.mjs`; the current
  app-specific CSP and trusted-checkout assertions stay in place.
- No branch-protection mutation from a generic blueprint script.

## Acceptance Criteria

1. The repository has a complete feature-memory folder for this adaptation.
2. The repository has a checked-in `.unicorn-hub/config.json` adapted to
   `pallete-maker` paths and defaults.
3. Future PRs have a checklist that asks for acceptance evidence, negative
   scenario coverage, and process-memory updates.
4. The AI command policy and review gate can rerun `AI Review` when trusted
   review commands or trusted reviewer output appear.
5. Local checks pass with `pnpm run preflight`.

## Negative Scenarios

- A generic Unicorn Hub file must not overwrite the existing trusted-checkout
  hardening in `ai-review.yml`, `pr-guard.yml`, or
  `check-static-baseline.mjs`.
- A new docs tree must not compete with `docs_pallete_maker/`.
- A bot-authored command must not become trusted review evidence.

## Assumptions

- `origin/main` is the source of truth for this PR.
- `AI_REVIEW_AGENT=codex` remains the repository default unless the owner
  explicitly changes it.
