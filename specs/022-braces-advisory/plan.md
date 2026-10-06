# Spec 022 — Plan

1. Override the transitive `@parcel/watcher` dependency to `2.6.0`, whose
   dependency graph no longer includes `braces`.
2. Regenerate the pnpm lockfile and verify that `braces` is absent.
3. Update the supply-chain documentation and run the full preflight suite.

The override is intentionally narrower than replacing Tailwind or disabling
OSV enforcement.
