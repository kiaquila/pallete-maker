# Spec 022 — Plan

1. Override the transitive `@parcel/watcher` dependency to `2.6.0`, whose
   dependency graph no longer includes `braces`.
2. Update `source-map-js` to the patched `1.2.2` release in the lockfile, with
   a package-specific release-age exception for the security fix.
3. Validate the html-validate and Prettier patch releases through the complete
   repository CI suite.
4. Regenerate the pnpm lockfile, verify that `braces` is absent, and update the
   dependency ledger and supply-chain documentation.

The remediation is intentionally narrower than replacing Tailwind or disabling
OSV enforcement.
