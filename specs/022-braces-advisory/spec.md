# Spec 022 — Braces Advisory Remediation

## Problem

OSV blocks dependency updates because `@tailwindcss/cli@4.3.3` resolves
`@parcel/watcher@2.5.1`, which pulls in vulnerable `braces@3.0.3`
(`GHSA-vfj7-8cjw-p6xm`). No patched `braces` release is available. A second
OSV finding affects `source-map-js@1.2.1` and is fixed in `1.2.2`. The PR also
updates `html-validate` from `11.16.0` to `11.16.1` and Prettier from `3.9.6`
to `3.9.9`.

## Goal

Accept the two direct development-tool updates and remove both vulnerable
transitive versions without changing application behavior or the Tailwind build
interface.

## Acceptance Criteria

- pnpm resolves `@parcel/watcher` to `2.6.0`.
- `pnpm-lock.yaml` no longer contains `braces`.
- `pnpm-lock.yaml` resolves `source-map-js` to exactly `1.2.2`.
- The release-age exception is limited to `source-map-js@1.2.2`.
- html-validate, Prettier formatting, the Tailwind build, and all tests pass.
- Repository preflight and the GitHub OSV scan pass.
- Supply-chain documentation records the override and its reason.
