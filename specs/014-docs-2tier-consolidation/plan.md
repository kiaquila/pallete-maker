# Plan 014 — Docs 2-tier Consolidation + Fact Sync

## Approach

Single-PR refactor in the `claude/silly-margulis-57ff15` worktree. No production code touched; only documentation files plus two workflow YAMLs whose fallback defaults must match the canonical declaration.

Execution order is driven by dependency (facts first, then canonical owners, then entry-point trimming, then ADR extraction), and all shipped in one commit set so Codex review sees the consolidated state rather than a half-migrated repo.

## Phases

### Phase 1 — Fact sync against code

Pre-read the source-of-truth files and fix all stale factual claims in one pass:

- `src/scripts/harmony.mjs:72-73` → palette `MAX_TOTAL = 15`, `MAX_CHROMATIC = 12`. Propagate to `CLAUDE.md:3`, `AGENTS.md:8`, `docs_pallete_maker/project-idea.md:9`.
- `index.html:221` → grid `repeat(11, 1fr)` at `≥1280px`. Fix stale `10` in `frontend-docs.md:44`.
- Repository variable `AI_REVIEW_AGENT=codex` (switched 2026-04-17, spec 008 T008b). Propagate to `AGENTS.md` default policy block, `constitution.md` Roles section, `project-idea.md:28`.
- Remove phantom references to `docs_pallete_maker/project/devops/macos-local-runners.md` (deleted in spec 006) from `AGENTS.md:109` and `constitution.md:77-84`.
- Flag Claude review (`claude-review.yml`, `ANTHROPIC_API_KEY`) as "currently non-operational (dead code pending cleanup)" in `review-contract.md` and `ai-orchestration-protocol.md` — do not describe as live.

### Phase 2 — Canonical ownership map

Establish single-source-of-truth files for each previously-duplicated block:

| Fact                             | Canonical owner                   | Other files                                              |
| -------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Palette size (15 = 12 + 3)       | `project-idea.md`                 | CLAUDE.md, AGENTS.md keep 1-line inline (hybrid pattern) |
| Grid columns (3/4/6/8/11)        | `frontend-docs.md`                | Referenced only                                          |
| Default review backend           | `ai-orchestration-protocol.md`    | Entry points keep 1-line inline                          |
| Standard Feature Loop (10 steps) | `.specify/memory/constitution.md` | `ai-pr-workflow.md` drops its duplicate, points back     |
| Bot-trigger rejection rules      | `review-trigger-automation.md`    | `review-contract.md` keeps 2-line summary + link         |
| OMC mode catalog                 | `CLAUDE.md`                       | `AGENTS.md` keeps one-line pointer                       |

Apply hybrid-reference pattern (`feedback_docs_consolidation_pattern.md`): short facts inline in entry points; long blocks (10+ lines) consolidated to canonical; mid-size (3-10 lines) get a 2-line summary + link in non-canonical locations.

### Phase 3 — Entry-point trimming + reading route unification

- `CLAUDE.md`: add 2 Karpathy-derived directives to "Важные правила"; keep OMC mode details (they are Claude-specific); add `delivery-playbook.md` and `adr/README.md` to the Documentation section; adjust palette fact.
- `AGENTS.md`: trim rule 7 (OMC block) to a one-liner pointing at CLAUDE.md; update Reading Route to include `review-contract.md`, `review-trigger-automation.md`, `delivery-playbook.md`, `vercel-cd.md`; remove phantom `macos-local-runners.md` from rule 4.
- `docs_pallete_maker/README.md`: remove "Main reading order" section entirely (replaced by AGENTS.md reference); rewrite Structure into a topical index grouped by Product / Frontend / Delivery & CI / Decisions.

### Phase 4 — Orientability headers in devops docs

Add `> Audience: ... | Prereq: ... | Next: ...` as the first line after the H1 in each of the 6 files under `docs_pallete_maker/project/devops/`. Five minutes per file, immediate navigation clarity.

### Phase 5 — ADR extraction

Create `docs_pallete_maker/adr/0001-review-trigger-design.md` containing Tier 2 (husky post-push hook) and Tier 3 (PAT-based GitHub Actions workflow) designs + PAT security requirements, relocated from `review-trigger-automation.md`. The operational doc keeps only Tier 1 (active) and a pointer to the ADR. Update `adr/README.md` with an index section listing the new ADR.

### Phase 6 — Workflow fallback alignment (reactive to Codex P2 #2)

`.github/workflows/ai-review.yml` line 78 and `ai-command-policy.yml` line 37 use `gemini` as the fallback when `AI_REVIEW_AGENT` is unset. The canonical doc declaration is `codex`. Change both fallbacks to `codex`, and update the explanatory comment in `ai-review.yml` to correctly state that only Gemini auto-reviews on PR open.

### Phase 7 — Verify and ship

- `pnpm run preflight` locally (feature-memory + baseline + html + build + format + tests).
- Commit, push, open PR with human-authored `@codex review` trigger.
- Address any Codex P0-P2 findings in subsequent commits on the same branch. P3 findings are advisory-only.

## Risk surface

**R1 — Link-following regression for CI-mode reviewers.** Codex / Gemini in review mode may not reliably follow internal doc links. When consolidating, if a critical fact is only at the canonical location, a reviewer reading a sibling file might answer from training data instead. Mitigation: hybrid-reference pattern. Short facts inline in entry points and near-sibling docs; only long blocks pure-reference.

**R2 — Stack-wide drift after changing a canonical declaration.** Declaring "default = codex" in docs left workflow fallbacks pointing to `gemini`. Codex found this on the first review round. Mitigation: grep the whole repo (workflows, scripts, tests) for the previous default value before claiming stack-wide consistency. Documented in `feedback_canonical_default_stack_audit.md`.

**R3 — Guard feature-memory gate on workflow changes.** `.github/workflows/` counts as product paths per `scripts/check-feature-memory.mjs`, so any workflow change requires a complete `specs/<id>/{spec,plan,tasks}.md` folder — which is this spec.

**R4 — `check-static-baseline.mjs` requires specific devops files.** The baseline check hardcodes `review-contract.md`, `review-trigger-automation.md`, `delivery-playbook.md`, etc. This refactor keeps all of them (trims content, not files), so baseline stays green.

**R5 — Prettier formatting on new markdown.** `docs_pallete_maker/README.md` needed a post-write reformat (blank lines between heading and list). Run `pnpm exec prettier --write` on any edited markdown before the final preflight.

## Rollback plan

All changes live on `claude/silly-margulis-57ff15`. If a regression surfaces post-merge (e.g. a reviewer hallucinates a now-pure-reference fact), revert-merge the PR and retry with more facts kept inline per hybrid-reference pattern. No schema migration, no data loss risk.
