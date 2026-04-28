# Tasks — 017-defense-in-depth-checkout-assertion

- [x] Append checkout-count assertion to `workflowAssertions` in
      `scripts/check-static-baseline.mjs`.
- [x] Run `pnpm run check:repo` — must pass (1 checkout in `ai-review.yml`).
- [x] Negative-case simulation: temporarily add a second
      `uses: actions/checkout@...` line and confirm `pnpm run check:repo` fails
      with the new message; revert.
- [x] Run `pnpm run preflight` — must pass.
- [ ] Push branch and open PR against `main`.
- [ ] Trigger Codex review via `gh pr comment <PR#> --body "@codex review"`.
