# 021 — html-validate 11.15 dependency refresh

## Problem

PR #41 updates the repository's development HTML validator from 11.14.0 to
11.15.0. Changes to `package.json` and `pnpm-lock.yaml` participate in the
repository's feature-memory and durable-documentation rules, but the generated
Dependabot branch did not include either record.

## Solution

Accept the Dependabot update while preserving the existing validation command
and product contract:

- update `html-validate` from 11.14.0 to 11.15.0
- accept the lockfile's transitive `fast-uri` update from 4.1.4 to 4.2.1
- record PRs #40 and #41 in the dependency update ledger
- keep `pnpm run check:html` and `.htmlvalidate.json` unchanged

The official 11.15.0 changelog adds `ErrorFixer.insertTextBefore()` and
`insertTextAfter()` APIs. This repository uses the CLI against `index.html`, so
the update does not intentionally change validation configuration or runtime
site behavior.

Source: <https://html-validate.org/changelog/index.html#1150-2026-09-07>

## Acceptance criteria

- a frozen-lockfile install succeeds on the supported Node/pnpm toolchain
- `pnpm run ci` passes, including `html-validate index.html`
- required GitHub checks and the Vercel preview are green
- Codex review has no unresolved blocking findings on the final head
