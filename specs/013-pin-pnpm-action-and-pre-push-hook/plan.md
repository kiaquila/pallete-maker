# Plan — 013-pin-pnpm-action-and-pre-push-hook

## Approach

Two unrelated infra fixes batched because each is too small to justify its own PR.

### A. Pin pnpm/action-setup

1. Resolve `pnpm/action-setup@v4` → annotated tag → commit SHA via `gh api repos/pnpm/action-setup/git/refs/tags/v4` then `gh api repos/.../git/tags/<annotated-tag-sha>`. Result: `b906affcce14559ad1aafd4ab0e942779e9f58b1`.
2. Apply `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4` in both workflow files (ci.yml line 35, pr-guard.yml line 111).
3. Document in `docs_pallete_maker/project/devops/vercel-cd.md` that pnpm/action-setup is now SHA-pinned (closes the only third-party-action exception).

### C. Local Claude Code pre-push hook

1. Write `.claude/hooks/check-feature-memory-on-push.sh`:
   - Reads tool-input JSON from stdin (Claude Code hook contract)
   - Extracts the `command` field via python3 (no jq dependency)
   - Greps for `git push` (covers `--force`, `--with-lease`, chained commands)
   - Runs `node scripts/check-feature-memory.mjs origin/main HEAD` from `$CLAUDE_PROJECT_DIR`
   - Exits 2 with stderr message on failure (Claude Code convention for blocking + visible)
   - Exits 0 otherwise
2. Add `hooks.PreToolUse` entry to `.claude/settings.local.json` with matcher `Bash` and command pointing at the script via `$CLAUDE_PROJECT_DIR`.
3. `chmod +x` the script.
4. Smoke-test by piping fake JSON: `echo '{"tool_input":{"command":"git push"}}' | .claude/hooks/...sh` should exit 0 when committed state has no missing spec, exit 2 when it does.
5. Document in CLAUDE.md «Важные правила»: hook exists, lives in `.claude/`, restore-on-clone instructions, emergency bypass (edit `.claude/settings.local.json` to comment out the hook, or run `git push` from a normal terminal where Claude Code is not active).

`.claude/` is fully gitignored so the hook script and settings stay machine-local. CLAUDE.md is committed and serves as the only durable reference for re-establishing the hook on a new machine.

## Risks

- **Hook fires on every Bash call.** It exits 0 immediately for non-push commands, but adds a few ms of overhead per call. Acceptable.
- **`python3` unavailable.** macOS bundles python3 since 12.3. Fallback path could use awk but adds complexity. Punt unless someone reports.
- **`$CLAUDE_PROJECT_DIR` unset.** Script falls back to `pwd` which works in normal flows but may be wrong if Claude is run from a parent directory. Acceptable since Claude Code sets the var in modern versions.
- **False positives.** If the hook misclassifies a non-push as a push (e.g. a comment-only string `"git push"` inside a different shell command), it would block. The regex requires whitespace before `git`, mitigating most cases.
- **No test coverage for the hook itself.** It's a 25-line bash script with a clear purpose; behavioural test would require a fake project tree. Smoke-tested manually.

## Done when

- All Spec 013 acceptance criteria met.
- `pnpm run preflight` passes.
- All PR checks green.
- The hook actively gates this very PR's push (or any future push) when a spec is missing.
