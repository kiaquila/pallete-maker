#!/usr/bin/env bash
# Router: dispatches to the agent-specific review script based on AI_REVIEW_AGENT.
set -euo pipefail

agent="${AI_REVIEW_AGENT:-claude}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$agent" in
  claude) exec bash "$script_dir/run-claude-pr-review.sh" ;;
  *) printf 'Unsupported local review agent: %s\n' "$agent" >&2; exit 1 ;;
esac
