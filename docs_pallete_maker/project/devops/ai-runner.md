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

- `claude` is the default implementation agent and the preferred review backend.
  Review runs on a self-hosted macOS runner via `claude -p` (print mode). The
  runner must be registered with labels `self-hosted`, `macOS`, `ai-runner` and
  the `claude` CLI must be authenticated (`claude auth`). No `ANTHROPIC_API_KEY`
  secret is required — the CLI uses the local Max subscription session.
  Set `CLAUDE_CLI_PATH` repository variable if the binary is not on `$PATH`.
- `gemini` is the fallback review backend and runs natively on GitHub pull
  requests via the Gemini Code Assist GitHub App without additional setup.
- `codex` is the optional review and implementation backend. Native Codex PR
  review needs no repository secret; Codex implementation requires the Codex
  app or Codex CLI to be available locally.

If a selected backend is missing its requirements, the workflow fails closed
with an explanatory comment instead of silently skipping.

## Backend Trigger Constraints

This matrix is the single source of truth for the trigger behaviour of
each review backend. Gemini and Codex use the gate-based path with
`trigger_mode=skip` on `pull_request` events. Claude uses the self-hosted
local runner path and triggers automatically without any human comment.

| Backend                                | Auto-review on `opened` / `ready_for_review` | Auto-review on `synchronize`     | Trigger mechanism                                                                                     | Manual recovery path                                                                |
| -------------------------------------- | -------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Gemini (`gemini-code-assist[bot]`)     | yes when the GitHub App is installed         | no                               | gate-based: trusted human posts `/gemini review`; bot-posted trigger silently ignored                 | `pnpm run review:switch -- --to gemini`                                             |
| Codex (`chatgpt-codex-connector[bot]`) | yes (Codex Cloud auto-reviews on PR open)    | no                               | gate-based: trusted human posts `@codex review`; bot-posted trigger rejected by connector             | `pnpm run review:switch -- --to codex`                                              |
| Claude (self-hosted CLI)               | **yes** — local runner picks up `opened`     | **yes** — picks up `synchronize` | **automatic**: `ai-review-local` job runs `claude -p` directly; no trigger comment needed or accepted | push a new commit, or `pnpm run review:switch -- --to claude` to rerun the last job |

Consequences for orchestration design:

- Claude review auto-triggers on both `opened` and `synchronize` events —
  every push to a PR is reviewed automatically without any manual step.
- Gemini Code Assist's on-open auto-review covers the initial PR review.
  Every subsequent push to a gemini-reviewed PR needs a manual trigger or
  a backend switch.
- The `pnpm run review:switch` helper is the canonical one-shot recovery
  path: it flips `AI_REVIEW_AGENT`, posts the correct native trigger comment
  for gemini or codex (skipped for claude since the runner auto-picks up
  the push), and reruns the most recent failed `AI Review` job.

## Review Gate

`AI Review` is a normalization layer on top of native vendor review outputs.

- Gemini path waits for native GitHub PR review output from
  `gemini-code-assist[bot]` and classifies inline review comments by
  `Critical`, `High`, `Medium`, and `Low` severity markers.
- Codex path waits for native GitHub PR review output from
  `chatgpt-codex-connector[bot]`.
- Claude path bypasses the gate entirely. The `ai-review-local` job runs
  `claude -p` directly on the self-hosted runner, posts the review as a PR
  comment, and the job succeeds or fails based on the CLI exit code.

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
