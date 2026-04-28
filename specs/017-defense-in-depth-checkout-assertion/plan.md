# Plan — 017-defense-in-depth-checkout-assertion

## Approach

1. Append a second entry to the `workflowAssertions` array in
   `scripts/check-static-baseline.mjs`. The test counts
   `uses: actions/checkout@` matches in the workflow file and passes only if
   the count is exactly 1.
2. Run `pnpm run check:repo` against current `main` (1 checkout) — must pass.
3. Run `pnpm run preflight` for the full local gate.
4. Manually simulate the attack: paste a second `uses: actions/checkout@...`
   line into `.github/workflows/ai-review.yml` and confirm
   `pnpm run check:repo` fails with the new message. Revert the change.

## Risk Notes

- This change only adds a static assertion. It cannot affect workflow runtime.
- The regex anchors on line start (`^[ \t]*-?[ \t]*uses:[ \t]*actions\/checkout@`,
  `m` flag) so YAML comments (`# uses: actions/checkout@...`) and literal
  occurrences inside `run:` scripts that begin with `#` are not counted.
  Optional leading `-` covers the inline `- uses: ...` step form. A literal
  `uses: actions/checkout@` inside a multi-line `run: |` block at column 0
  would still match — accepted as a false positive since no realistic edit to
  `ai-review.yml` writes that.
- The existing trusted-`ref` assertion still runs first, so a workflow that
  removes the trusted ref entirely would fail with the spec 016 message,
  not the new one.

## Done When

- `pnpm run check:repo` passes on the modified branch.
- Negative case (manual second-checkout simulation) fails `pnpm run check:repo`
  with the new message and is reverted.
- `pnpm run preflight` passes locally.
- Branch is pushed and a PR is opened against `main`.
