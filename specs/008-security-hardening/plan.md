# Plan — 008-security-hardening

## Approach

Single PR, five surface areas, all declarative config. No runtime code touched.

1. **Response headers** — add `headers` array in `vercel.json`. CSP allowlist mirrors the exact external origins in `index.html` (`cdnjs.cloudflare.com`, `fonts.googleapis.com`, `fonts.gstatic.com`). `'unsafe-inline'` retained for scripts and styles because the static build inlines `harmony.mjs` and CSS variables.
2. **OSV scan** — new workflow `osv-scan.yml`, uses `google/osv-scanner-action/osv-scanner-action@<sha>` pointing to v2.3.5, scans `pnpm-lock.yaml`, table format for PR log readability.
3. **Dependabot** — new `.github/dependabot.yml`, two ecosystems (`github-actions`, `npm`), Monday 07:00 Europe/Moscow, cooldown per semver level.
4. **SHA-pinning** — resolve `anthropics/claude-code-action@v1` via `gh api repos/anthropics/claude-code-action/git/refs/tags/v1` → annotated tag → commit SHA `c3d45e8e…`. Apply in `claude-agent.yml:111` and `claude-review.yml:106`. Keep `# v1` trailing comment.
5. **Docs** — append *Security Headers* and *Supply-chain Hygiene* sections to `vercel-cd.md`.

## Risks

- **CSP breaks the page** if an origin is missed. Mitigation: preview deploy per PR; verify browser console before merge.
- **OSV Scan flags transitive deps we can't fix quickly.** Mitigation: the scan runs on `pnpm-lock.yaml` and the repo has only three dev-deps (`html-validate`, `prettier`, `tailwindcss`); false-positive surface is small. If it fails, triage via `critic` subagent.
- **Dependabot PR noise.** Mitigation: `open-pull-requests-limit: 5` per ecosystem, cooldown settings.
- **`unsafe-inline` leaves XSS surface.** Accepted for now; tracked as non-goal.

## Done when

- All Spec 008 acceptance criteria met.
- PR #11 all checks green (CI, PR Guard, OSV Scan, AI Review, Vercel preview).
- Browser smoke on preview URL shows no console CSP violations on golden path.
