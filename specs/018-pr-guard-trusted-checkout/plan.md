# Plan — 018

1. `pr-guard.yml`: change `ref` to `inputs.ref || github.event.repository.default_branch`; add `Fetch PR head` step → verify: checkout step matches baseline assertion
2. `check-feature-memory.mjs`: `hasCompleteFeatureMemory` uses `git cat-file -e headRef:path` in CI mode → verify: spec files found via git objects
3. `check-static-baseline.mjs`: add `--head-ref` mode with `existsAtRef`/`readAtRef` helpers; add `prGuardAssertions` → verify: self-enforcing baseline catches revert attempts
