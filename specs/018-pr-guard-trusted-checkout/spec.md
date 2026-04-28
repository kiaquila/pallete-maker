# 018 — PR Guard trusted checkout

## Problem

`pr-guard.yml` checked out `github.event.pull_request.head.sha` and then executed scripts from that checkout with `pull-requests: write` permission. A malicious fork PR could replace `scripts/check-feature-memory.mjs` or `scripts/check-static-baseline.mjs` to run arbitrary code in the privileged workflow context (ACE via untrusted PR head).

## Solution

Mirror the pattern already applied to `ai-review.yml` (spec 016/017):

- Checkout `default_branch` (trusted main)
- Fetch PR head SHA separately for diffing only
- Scripts that need to inspect PR head state use `git cat-file`/`git show` instead of filesystem reads

## Scope

- `.github/workflows/pr-guard.yml`
- `scripts/check-feature-memory.mjs`
- `scripts/check-static-baseline.mjs`
