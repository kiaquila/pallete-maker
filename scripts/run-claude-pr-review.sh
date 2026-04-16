#!/usr/bin/env bash
# Runs a Claude CLI review for the given PR and posts the result as a comment.
# Required env: PR_NUMBER, PR_BASE_REF, PR_HEAD_SHA, GITHUB_TOKEN
# Optional env: CLAUDE_CLI_PATH (defaults to "claude")
set -euo pipefail

pr_number="${PR_NUMBER:?PR_NUMBER is required}"
base_ref="${PR_BASE_REF:?PR_BASE_REF is required}"
head_sha="${PR_HEAD_SHA:?PR_HEAD_SHA is required}"
claude_bin="${CLAUDE_CLI_PATH:-claude}"

# Fetch base branch so merge-base is available
git fetch --no-tags origin "$base_ref"
base_sha=$(git merge-base "origin/$base_ref" "$head_sha")

# Build diff context — cap at 64 KB to stay within model context
changed_files=$(git diff --name-only "$base_sha" "$head_sha")
diff_output=$(git diff --unified=3 "$base_sha" "$head_sha" | head -c 65536)

# Load versioned prompt template
template=$(cat ".github/claude/prompts/pr-review.md")

# Assemble full prompt
prompt=$(printf '%s\n\n### Changed files\n\n%s\n\n### Diff\n\n```diff\n%s\n```' \
  "$template" "$changed_files" "$diff_output")

# Invoke Claude CLI in non-interactive print mode
stderr_log=$(mktemp /tmp/claude-review-stderr.XXXXXX)
review=$(printf '%s' "$prompt" | "$claude_bin" -p --output-format text \
  --permission-mode bypassPermissions 2>"$stderr_log")
exit_code=$?

if [ "$exit_code" -ne 0 ]; then
  printf 'Claude CLI exited %s:\n' "$exit_code" >&2
  cat "$stderr_log" >&2
  rm -f "$stderr_log"
  exit "$exit_code"
fi
rm -f "$stderr_log"

# Post review as a PR comment
gh pr comment "$pr_number" --body "<!-- ai-review-local -->

$review"
