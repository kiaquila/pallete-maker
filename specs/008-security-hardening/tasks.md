# Tasks — 008-security-hardening

- [x] T001: Add `headers` block to `vercel.json` with CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- [x] T002: Resolve `anthropics/claude-code-action@v1` to commit SHA via `gh api` and pin in `claude-agent.yml` and `claude-review.yml` with `# v1` trailing comment
- [x] T003: Create `.github/workflows/osv-scan.yml`, pin `google/osv-scanner-action` to v2.3.5 SHA, trigger on PR/push/weekly/dispatch
- [x] T004: Create `.github/dependabot.yml` for `github-actions` and `npm` with weekly schedule and per-semver cooldown
- [x] T005: Append _Security Headers_ and _Supply-chain Hygiene_ sections to `docs_pallete_maker/project/devops/vercel-cd.md`
- [x] T006: `pnpm run ci` passes locally (38/38 tests, HTML valid, build, format, baseline)
- [x] T007: Open PR #11 against `main`
- [x] T008a: baseline-checks / guard / osv-scan / Vercel green on `1e71d51`
- [x] T008b: AI Review — resolved by switching `AI_REVIEW_AGENT` `gemini` → `codex` (2026-04-17). Codex reviewed and posted "Didn't find any major issues. Nice work!" twice. `ai-review-gate` dispatch run (`24574085471`) passed with SUCCESS.
- [x] T009: Browser smoke on preview URL — user verified manually (2026-04-17). Only non-app CSP violation is Vercel's own `vercel.live/_next-live/feedback/feedback.js` preview widget, correctly blocked by our CSP; app golden path (palette select + PNG export) produces zero CSP violations.
- [ ] T010: Merge PR #11 after all checks COMPLETED + SUCCESSFUL per `feedback_never_merge_before_review.md` — user decision.
