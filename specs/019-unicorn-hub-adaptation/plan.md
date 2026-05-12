# 019 — Plan

## Implementation Plan

1. Refresh repository docs that still describe the pre-modularized app.
2. Add a minimal Unicorn Hub config and shared script helpers while preserving
   existing app-specific gates.
3. Add SENAR-oriented PR/spec templates adapted to the current docs system.
4. Add event-driven AI Review rerun scripts/workflow and move the inline command
   policy into a repository-owned script.
5. Cover the new helpers with `node:test`, then run the full preflight.

## Verification Matrix

| Acceptance criterion      | Evidence                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Feature memory exists     | `specs/019-unicorn-hub-adaptation/{spec,plan,tasks}.md`                                                 |
| Config is adapted         | `.unicorn-hub/config.json` points at `docs_pallete_maker`, `specs`, and static Vercel paths             |
| PR checklist exists       | `.github/pull_request_template.md`                                                                      |
| Event-driven rerun exists | `.github/workflows/ai-review-rerun.yml`, `scripts/ai-command-policy.mjs`, `scripts/ai-review-rerun.mjs` |
| Existing gates preserved  | `pnpm run check:repo`, `pnpm run test`, `pnpm run preflight`                                            |

## Risk Notes

- The biggest risk is weakening trusted-checkout protections while importing
  generic workflow patterns. This PR keeps the existing single trusted checkout
  invariant for `AI Review` and the existing trusted PR Guard design.
- Event-driven review relies on GitHub Actions rerun permissions. The workflow
  uses the repository `GITHUB_TOKEN` with `actions: write`.

## Complexity Tracking

The new `.unicorn-hub/config.json` and `scripts/shared.mjs` introduce a small
configuration layer. The current pain it solves is drift between reusable
workflow scripts and app-specific path lists; simpler hardcoded logic remains in
place where it carries app-specific assertions.
