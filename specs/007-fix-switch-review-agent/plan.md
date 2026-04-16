# Plan — 007-fix-switch-review-agent

## Approach

Two minimal edits to `scripts/switch-review-agent.mjs`:

1. Replace the `triggerBodies` map entry for `claude` with `"@claude review once"` and update the header comment.
2. Simplify step 2 by removing the `triggerBody === null` branch; all three agents now have a trigger comment.

Plus one-line note in `AGENTS.md` script tree so the guard docs-coverage check is satisfied.

## Risks

- None runtime-visible; the change only activates a previously dead code path for `--to claude`.
- If someone relied on `--to claude` being a no-op for trigger comment (unlikely; the switch command's purpose is to also trigger the new reviewer), they can still pass `--no-comment`.

## Done when

- Spec acceptance criteria met.
- PR #10 checks green and merged.
