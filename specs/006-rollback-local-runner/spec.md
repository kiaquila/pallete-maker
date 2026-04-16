# Spec 006 — Rollback local Claude self-hosted runner

## Problem

PR #7 (`feat: local Claude runner for AI review via self-hosted macOS runner`) introduced a self-hosted macOS runner for Claude CLI-based PR review. Security review on 2026-04-16 found 3 critical vulnerabilities:

1. Arbitrary code execution via PR-controlled `scripts/run-ai-pr-review.sh` in `actions/checkout` of a public-repo pull_request event.
2. Prompt injection via attacker-controlled `CLAUDE.md` / `.github/claude/prompts/pr-review.md` from the PR checkout; Claude CLI was invoked without `--allowedTools`.
3. CVE-2025-43714 / CVE-2025-59536 — malicious `.claude/settings.json` with `ANTHROPIC_BASE_URL` override in a PR checkout exfiltrates the OAuth bearer token.

The runner lived inside the project tree (`.claude/runners/ai-runner/`) on the maintainer's personal dev machine, amplifying blast radius to Keychain, SSH keys, and cloud credentials. Compromise did not occur (all 8 PRs were from the repo owner; no external forks), but the attack window was open.

Trail of Bits calls self-hosted runners on public repos "the single most dangerous misconfiguration in GitHub Actions." The only acceptable long-term fix is to abandon this pattern.

## Goals

- Remove the local runner job, scripts, prompt template, and docs from the main branch.
- Restore the default cloud-only review setup: Gemini auto-review on PR open; `@codex review` and `@claude review once` as on-demand comment triggers handled by existing cloud workflows.
- Document the human-comment constraint for all three review backends and propose a tiered automation strategy.

## Non-goals

- Rewriting Gemini/Codex/Claude review workflow logic beyond removing the local path.
- Setting up the automation proposal itself (that is a future spec).
- Rewriting historical commits in `specs/005-local-claude-runner/` — leave it as a historical record.

## Acceptance criteria

- `.github/workflows/ai-review.yml` no longer contains the `ai-review-local` job.
- `scripts/run-claude-pr-review.sh`, `scripts/run-ai-pr-review.sh`, `.github/claude/prompts/pr-review.md` deleted.
- `.github/claude/` removed if empty after deletion.
- `docs_pallete_maker/project/devops/ai-runner.md` and `macos-local-runners.md` deleted.
- `CLAUDE.md` and `docs_pallete_maker/README.md` no longer reference the removed docs.
- `docs_pallete_maker/project/devops/review-contract.md` Claude section updated to reflect comment-based trigger only.
- `docs_pallete_maker/project/devops/ai-pr-workflow.md` Related Docs list updated.
- New doc `docs_pallete_maker/project/devops/review-trigger-automation.md` explains the human-comment constraint and proposes three tiers of automation.
- `pnpm run build` still passes.
- `pnpm test` still passes (if tests exist and pass on main).
- PR is opened against main but NOT merged.
