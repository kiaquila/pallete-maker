# Spec 022 — Braces Advisory Remediation

## Problem

OSV blocks dependency updates because `@tailwindcss/cli@4.3.3` resolves
`@parcel/watcher@2.5.1`, which pulls in vulnerable `braces@3.0.3`
(`GHSA-vfj7-8cjw-p6xm`). No patched `braces` release is available.

## Goal

Remove the vulnerable dependency chain without changing application behavior or
the Tailwind build interface.

## Acceptance Criteria

- pnpm resolves `@parcel/watcher` to `2.6.0`.
- `pnpm-lock.yaml` no longer contains `braces`.
- Repository preflight and the GitHub OSV scan pass.
- Supply-chain documentation records the override and its reason.
