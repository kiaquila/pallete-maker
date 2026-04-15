# AI Runner

## Repository Variables

The orchestration layer reads:

- `AI_IMPLEMENTATION_AGENT`
- `AI_REVIEW_AGENT`

If a variable is unset, the workflows fall back to repository defaults:

- implementation: `claude`
- review: `gemini`

Local macOS helper scripts may also store the current selection under:

- `.claude/implementation-agent`
- `.claude/review-agent`

## Backend Requirements

- `claude` is the default implementation agent. The user runs it from a local
  Claude Code terminal session, and no additional GitHub secret is required
  for the default implementation path. When `claude` is used as a third-tier
  review backend through the `@claude` GitHub app, `ANTHROPIC_API_KEY` must be
  configured in repository secrets.
- `gemini` is the default review backend and runs natively on GitHub pull
  requests via the Gemini Code Assist GitHub App without additional setup.
- `codex` is the optional review and implementation backend. Native Codex PR
  review needs no repository secret; Codex implementation requires the Codex
  app or Codex CLI to be available locally.

If a selected backend is missing its requirements, the workflow fails closed
with an explanatory comment instead of silently skipping.

## Backend Trigger Constraints

None of the supported review backends accept bot-posted trigger comments
on `pull_request` events. This matrix is the single source of truth for
why `ai-review.yml` keeps `trigger_mode=skip` on every `pull_request`
event regardless of the selected backend.

| Backend                                | Auto-review on `opened` / `ready_for_review` | Auto-review on `synchronize` | Accepts bot-posted trigger comment                                                                                 | Manual recovery path                                                                 |
| -------------------------------------- | -------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Gemini (`gemini-code-assist[bot]`)     | yes when the GitHub App is installed         | no                           | **no** — silently ignored, the gate times out after 20 minutes                                                     | trusted human posts `/gemini review` (responses arrive within ~2 minutes)            |
| Codex (`chatgpt-codex-connector[bot]`) | yes (Codex Cloud auto-reviews on PR open)    | no                           | **no** — connector replies "trigger did not come from a connected human Codex account" and the gate fails fast     | trusted human posts `@codex review`, or run `pnpm run review:switch -- --to <other>` |
| Claude (`claude[bot]`)                 | no                                           | no                           | **no** — `claude-review.yml` gates on `author_association in (OWNER, MEMBER, COLLABORATOR)` and drops bot comments | trusted human posts `@claude review once`                                            |

Consequences for orchestration design:

- Auto-retrigger on `synchronize` is not achievable from within a stock
  GitHub Actions workflow.
- Gemini Code Assist's on-open auto-review covers the initial PR review.
  Every subsequent push needs a manual trigger or a backend switch.
- The `pnpm run review:switch` helper is the canonical one-shot
  recovery path: it flips `AI_REVIEW_AGENT`, posts the correct native
  trigger comment on behalf of the current user (via `gh` CLI, so the
  comment is human-authored and trusted), and reruns the most recent
  failed `AI Review` job on the current head SHA.

## Review Gate

`AI Review` is a normalization layer on top of native vendor review outputs.

- Gemini path waits for native GitHub PR review output from
  `gemini-code-assist[bot]` and classifies inline review comments by
  `Critical`, `High`, `Medium`, and `Low` severity markers.
- Codex path waits for native GitHub PR review output from
  `chatgpt-codex-connector[bot]`.
- Claude path waits for a top-level `claude[bot]` comment containing:
  - `AI_REVIEW_AGENT: claude`
  - `AI_REVIEW_SHA: <head sha>`
  - `AI_REVIEW_OUTCOME: pass|advisory|block`

## Feature Memory Gate

`guard` is also responsible for ensuring that product-code changes do not land
without a complete `specs/<feature-id>/` update.

For `pallete-maker`, product-code paths are:

- `index.html`
- `package.json` and `pnpm-lock.yaml`
- `.htmlvalidate.json`
- `.github/workflows/`
- `scripts/`
- `src/`
- future `app/`, `public/`, and `assets/` folders
- `vercel.json`

## Gemini Operational Note

Manual Gemini comments such as `/gemini review` or `@gemini-code-assist review`
stay native-only in this repository.

- they do not dispatch `ai-review.yml`
- this avoids canceling the PR-linked `AI Review` check
- if Gemini has already reviewed the current PR head SHA, rerunning the
  PR-linked `AI Review` check is enough for the gate to accept that same-head
  review output
