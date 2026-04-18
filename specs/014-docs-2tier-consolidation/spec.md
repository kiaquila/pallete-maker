# Spec 014 — Docs 2-tier Consolidation + Fact Sync

## Problem

After 13 PRs of incremental docs growth, agent-facing documentation had accumulated four distinct friction classes that the 2026-04-18 audit (critic + architect subagents on PR #17 preparation) made explicit:

1. **Four competing entry points.** `CLAUDE.md`, `AGENTS.md`, `.specify/memory/constitution.md`, and `docs_pallete_maker/README.md` all claimed "read me first". Agents (Claude, Codex, Gemini) ended up reading the same information 2-3 times in different phrasings with no single source of truth.

2. **Fact drift with 3 simultaneous values.** The palette size appeared as "up to 10" (CLAUDE.md, AGENTS.md), "up to 14 (11 chromatic + 3 achromatic)" (project-idea.md), and "up to 15" (docs_pallete_maker/README.md), while the actual code in `src/scripts/harmony.mjs:72-73` has `MAX_TOTAL = 15, MAX_CHROMATIC = 12`. Grid columns had the same pattern: `11` on line 13 vs `10` on line 44 of `frontend-docs.md`, with `index.html:221` actually using `repeat(11, 1fr)`. This class of drift was already documented as a recurring hallucination source in `feedback_docs_drift_audit.md`.

3. **Stale review-agent policy.** Docs still said "Gemini is the default review backend" everywhere (7 files verbatim) even though the repository switched to `AI_REVIEW_AGENT=codex` on 2026-04-17 (spec 008 T008b). Worse, the workflow fallbacks in `.github/workflows/ai-review.yml` and `ai-command-policy.yml` still defaulted to `gemini` when the variable was unset.

4. **Phantom file references + dead-code paths advertised as operational.** Both `AGENTS.md:109` and `.specify/memory/constitution.md:80` still linked to `docs_pallete_maker/project/devops/macos-local-runners.md`, a file deleted in spec 006. `review-contract.md` and `ai-orchestration-protocol.md` described the Claude review path as a live third-tier option despite the local runner rollback (spec 006) and absent `ANTHROPIC_API_KEY`.

## Goals

- Reduce agent-facing entry points from 4 to 2: `CLAUDE.md` (Claude-specific, OMC modes) and `AGENTS.md` (universal). `constitution.md` and `docs_pallete_maker/README.md` become content / topical-index files, referenced from the entry points rather than competing with them.
- Establish a canonical-ownership map for every fact that previously lived in 2+ files. Other files reference the canonical source instead of duplicating content. Short (≤1-2 line) facts that are cited on every read — palette size, default review agent — stay inline in entry points to preserve CI-mode reviewer orientability.
- Actualize every factual claim against the current code: palette size from `src/scripts/harmony.mjs`, grid columns from `index.html`, review default from repository variables, security-header set from `vercel.json`.
- Remove all phantom references. Mark non-operational paths (Claude review, ANTHROPIC_API_KEY) explicitly as dead code pending a separate cleanup PR, rather than describing them as live.
- Align `.github/workflows/ai-review.yml` and `ai-command-policy.yml` fallback defaults with the canonical declaration (`review: "codex"` when the variable is unset). Docs and code must not disagree about what the default is.
- Adopt two Karpathy-derived CLAUDE.md directives (critic-validated delta from `multica-ai/andrej-karpathy-skills`): forbid speculative abstractions for single-use code; require an inline step+verify plan for 3-5-step routine tasks too small for a full spec.
- Add orientability headers (`> Audience: ... | Prereq: ... | Next: ...`) to all 6 devops docs so agents jumping in cold have one-line navigation cues.
- Extract the not-adopted Tier 2/3 review-trigger designs out of `review-trigger-automation.md` (operational doc) into a new ADR `docs_pallete_maker/adr/0001-review-trigger-design.md`. The operational doc keeps only the active Tier 1.

## Non-goals

- No product-code changes. `index.html`, `src/`, tests, and `scripts/` app logic are untouched.
- No deletion of the `claude-review.yml` workflow file itself (tracked in a separate cleanup PR per memory `project_local_claude_runner.md`).
- No adoption of Tier 2 (husky post-push hook) or Tier 3 (PAT-based automation) for review triggers — only the design is relocated.
- No new tests. Documentation coverage is verified by `check-static-baseline.mjs` (still passes) and manual review.
- No CSP tightening, no new security headers — PR #11 set the baseline and remains the canonical source.

## Acceptance criteria

- `CLAUDE.md` and `AGENTS.md` are the only files that claim "start here"; both link forward rather than duplicate long blocks.
- `docs_pallete_maker/README.md` contains a topical index only (grouped by Product / Frontend / Delivery & CI / Decisions); reading order lives solely in `AGENTS.md § Reading Route`.
- Every fact with a known canonical owner appears only once; other locations reference it. Concretely: palette size in `project-idea.md`; grid columns in `frontend-docs.md`; review default in `ai-orchestration-protocol.md`; Standard Feature Loop in `constitution.md`; bot-trigger rejection details in `review-trigger-automation.md`; OMC mode catalog in `CLAUDE.md`.
- `grep -rn "up to 10 colors\|до 10 цветов\|up to 14 colors"` returns only historical specs (no active docs).
- `grep -rn "macos-local-runners"` in active docs returns zero matches (only historical specs remain).
- `.github/workflows/ai-review.yml` and `ai-command-policy.yml` fall back to `codex` when `AI_REVIEW_AGENT` is unset.
- `.github/workflows/ai-review.yml` includes an updated comment noting that only Gemini auto-reviews on PR open; Codex and Claude require a human trigger on every review.
- `review-contract.md` includes a 2-line summary of bot-trigger rejection with a link to `review-trigger-automation.md` — not full duplication, but not pure reference either (hybrid-reference pattern, `feedback_docs_consolidation_pattern.md`).
- `CLAUDE.md` "Важные правила" section includes the two Karpathy-derived directives (no speculative abstractions; inline step+verify plan for multi-step tasks).
- All 6 files under `docs_pallete_maker/project/devops/` start with a `> Audience | Prereq | Next` orientability header.
- `docs_pallete_maker/adr/0001-review-trigger-design.md` exists and contains the Tier 2 and Tier 3 designs + PAT security requirements extracted from `review-trigger-automation.md`.
- `docs_pallete_maker/adr/README.md` lists the new ADR in an index section.
- `pnpm run preflight` passes (feature-memory gate + baseline + html-validate + build + prettier + 59/59 tests).
- All required PR checks (`baseline-checks`, `guard`, `osv-scan`, `AI Review`) are green.
- Codex review on the final PR head is green (no remaining P0-P2 findings). P3 findings are advisory-only per `review-contract.md`.

## Expected net delta

Net `-70` lines across `CLAUDE.md`, `AGENTS.md`, constitution, docs/README, 6 devops docs, project-idea, frontend-docs — duplicated blocks consolidated to canonical homes. One new ADR added. Two workflow YAMLs adjusted (single-line constant change each). No production behavior change.
