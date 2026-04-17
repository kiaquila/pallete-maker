# Tasks — 008-security-hardening

- [x] T001: Add `headers` block to `vercel.json` with CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- [x] T002: Resolve `anthropics/claude-code-action@v1` to commit SHA via `gh api` and pin in `claude-agent.yml` and `claude-review.yml` with `# v1` trailing comment
- [x] T003: Create `.github/workflows/osv-scan.yml`, pin `google/osv-scanner-action` to v2.3.5 SHA, trigger on PR/push/weekly/dispatch
- [x] T004: Create `.github/dependabot.yml` for `github-actions` and `npm` with weekly schedule and per-semver cooldown
- [x] T005: Append _Security Headers_ and _Supply-chain Hygiene_ sections to `docs_pallete_maker/project/devops/vercel-cd.md`
- [x] T006: `pnpm run ci` passes locally (38/38 tests, HTML valid, build, format, baseline)
- [x] T007: Open PR #11 against `main`
- [x] T008a: baseline-checks / guard / osv-scan / Vercel green on `8a1f50c`
- [ ] T008b: AI Review green — **BLOCKED on confirmed Gemini hallucinations** (2× HIGH on `cooldown` "not supported" contradicted by official Dependabot docs; 2× MEDIUM claiming files missing that are present in diff). See PR comment for triage evidence. Requires user decision: (A) switch `AI_REVIEW_AGENT` to `codex` or `claude` for this PR and re-run; (B) accept failure and merge with override.
- [ ] T009: Browser smoke on preview URL — **SKIPPED in automated run**: preview deploy is behind Vercel SSO (curl returns 401). Must be done manually by the user before merge; instructions posted in PR comment.
- [ ] T010: Merge PR #11 after all checks COMPLETED + SUCCESSFUL per `feedback_never_merge_before_review.md` — requires user decision on T008b first.
