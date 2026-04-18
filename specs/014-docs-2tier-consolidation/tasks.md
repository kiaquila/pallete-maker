# Tasks 014 — Docs 2-tier Consolidation + Fact Sync

## Phase 1 — Fact sync

- [x] T001: Palette size → `up to 15 (12 chromatic + 3 achromatic)` in `CLAUDE.md:3`, `AGENTS.md:8`, `docs_pallete_maker/project-idea.md:9`.
- [x] T002: Grid columns → `11 at ≥1280px` in `frontend-docs.md:44` (stale `10` → `11`).
- [x] T003: Default review backend → `codex` in `AGENTS.md` default-policy block, `constitution.md` Roles, `project-idea.md:28`, `CLAUDE.md:13`.
- [x] T004: Remove phantom `macos-local-runners.md` references from `AGENTS.md:109` (rule 4) and `constitution.md:77-84`.
- [x] T005: Flag Claude review path as "currently non-operational (dead code pending cleanup)" in `review-contract.md` and `ai-orchestration-protocol.md`.

## Phase 2 — Canonical ownership

- [x] T006: Palette size canonical in `project-idea.md`; keep 1-line inline in CLAUDE.md and AGENTS.md (hybrid).
- [x] T007: Grid columns canonical in `frontend-docs.md`; all other refs link.
- [x] T008: Default review backend canonical in `ai-orchestration-protocol.md`; entry points keep 1-line inline.
- [x] T009: Standard Feature Loop canonical in `constitution.md`; `ai-pr-workflow.md` drops duplicate and points back.
- [x] T010: Bot-trigger rejection canonical in `review-trigger-automation.md`; `review-contract.md` keeps 2-line summary + link.
- [x] T011: OMC mode catalog canonical in `CLAUDE.md`; `AGENTS.md` rule 7 trimmed to one-line pointer.

## Phase 3 — Entry-point trimming + reading route

- [x] T012: Add 2 Karpathy-derived directives to `CLAUDE.md § Важные правила` (no speculative abstractions; inline step+verify plan for multi-step routine tasks).
- [x] T013: Add `delivery-playbook.md` and `adr/README.md` to `CLAUDE.md § Документация`.
- [x] T014: Rewrite `docs_pallete_maker/README.md` as a topical index (Product / Frontend / Delivery & CI / Decisions); remove "Main reading order" section.
- [x] T015: Update `AGENTS.md § Reading Route` to include `review-contract.md`, `review-trigger-automation.md`, `delivery-playbook.md`, `vercel-cd.md`; reference this as canonical reading order.

## Phase 4 — Orientability headers

- [x] T016: Add `> Audience | Prereq | Next` header to `ai-orchestration-protocol.md`.
- [x] T017: Add orientability header to `ai-pr-workflow.md`.
- [x] T018: Add orientability header to `review-contract.md`.
- [x] T019: Add orientability header to `review-trigger-automation.md`.
- [x] T020: Add orientability header to `delivery-playbook.md`.
- [x] T021: Add orientability header to `vercel-cd.md`.
- [x] T022: Add orientability header to `frontend-docs.md`.

## Phase 5 — ADR extraction

- [x] T023: Create `docs_pallete_maker/adr/0001-review-trigger-design.md` with Tier 2/3 designs + PAT security.
- [x] T024: Trim `review-trigger-automation.md` to Tier 1 (active) + pointer to ADR.
- [x] T025: Update `docs_pallete_maker/adr/README.md` with Index section listing the new ADR.

## Phase 6 — Workflow fallback alignment

- [x] T026: `.github/workflows/ai-review.yml:78` — change fallback from `selected="gemini"` to `selected="codex"` when `AI_REVIEW_AGENT` is empty.
- [x] T027: `.github/workflows/ai-review.yml:40` — update header comment from `(and unset default → gemini)` to `(and unset default → codex)`.
- [x] T028: `.github/workflows/ai-review.yml` — update skip-mode explanatory comment to note that only Gemini auto-reviews on PR open; Codex and Claude require a human trigger on every review.
- [x] T029: `.github/workflows/ai-command-policy.yml:37` — change `defaults = { implementation: "claude", review: "gemini" }` to `defaults = { implementation: "claude", review: "codex" }`.

## Phase 7 — Verify and ship

- [x] T030: Fix P2 finding from Codex round 1 on `ai-pr-workflow.md` — clarify that Codex requires a human trigger on PR open, not just on synchronize.
- [x] T031: Reformat `docs_pallete_maker/README.md` with Prettier (blank lines between H2 and list).
- [x] T032: Run `pnpm run preflight` — feature-memory + baseline + html + build + format + 59/59 tests green.
- [x] T033: Commit + push + post `@codex review` on the PR with the current head SHA.
- [ ] T034: Resolve remaining Codex findings on the final head; confirm `AI Review` check SUCCESS on the current head SHA.
- [ ] T035: Confirm all required checks green (`baseline-checks`, `guard`, `osv-scan`, `AI Review`, `Vercel`).
- [ ] T036: Human merge after all checks are COMPLETED + SUCCESSFUL (per CLAUDE.md rule: never merge on MERGEABLE/UNSTABLE).
