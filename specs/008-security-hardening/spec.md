# Spec 008 — Security Hardening: CSP, OSV, Dependabot, SHA-pinned Actions

## Problem

After the local Claude runner rollback (PRs #9/#10) the repository had several residual supply-chain gaps:

- `vercel.json` set no response headers — external scripts could be swapped at CDN level and the browser would execute anything served. No HSTS, no clickjacking protection.
- No vulnerability scan on dependencies. `npm audit` is not part of CI and would miss many OSV-covered CVEs.
- Third-party GitHub Actions were pinned to moving tags (`anthropics/claude-code-action@v1`). Moving tags can be re-pointed; a SHA cannot.
- No automation for keeping actions and npm deps current.

The vibecode.morecil.ru/ru wiki review (2026-04-17) surfaced OSV Scanner, SHA-pinning, and explicit CSP/HSTS gates as concrete low-cost mitigations.

## Goals

- Baseline security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) on every response from Vercel.
- Automated vulnerability scan on every PR, push to `main`, and weekly schedule.
- Third-party actions pinned to commit SHA with trailing `# v<tag>` comment for readability.
- Automated update PRs for actions and npm with cooldown protection against freshly compromised releases.
- Durable documentation of the policy in `docs_pallete_maker/project/devops/vercel-cd.md`.

## Non-goals

- Tightening CSP to nonces/hashes — requires reworking `build-static.mjs` inlining, tracked as follow-up.
- Removing dead local-runner code left in `main` after PR #9 — separate cleanup PR.
- Changing Vercel project settings; all hardening is in-repo.

## Acceptance criteria

- `vercel.json` declares `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` for `/(.*)`.
- `.github/workflows/osv-scan.yml` present, triggers on `pull_request`, `push` to `main`, weekly cron, and `workflow_dispatch`; uses pinned SHA for `google/osv-scanner-action`.
- `.github/dependabot.yml` configures `github-actions` and `npm` with weekly interval and cooldown (default 7, major 14, minor 7, patch 3 days).
- `anthropics/claude-code-action` pinned to SHA in `claude-agent.yml` and `claude-review.yml`.
- `docs_pallete_maker/project/devops/vercel-cd.md` documents headers and supply-chain hygiene.
- All existing checks pass: `pnpm run ci`, PR Guard (docs coverage + feature memory), OSV Scan, AI Review.
- Preview deployment in the browser shows no CSP violations on golden path (open palette tool, select colors, export PNG).
