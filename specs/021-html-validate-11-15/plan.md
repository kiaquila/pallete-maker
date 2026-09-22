# Plan — 021

1. Merge the current `origin/main` into the Dependabot branch so PR #41 is
   evaluated after PR #40.
2. Preserve the generated `html-validate` and lockfile updates without changing
   validation configuration.
3. Add complete feature memory and update the dependency ledger.
4. Install with the frozen lockfile and run the complete repository CI command.
5. Push the same PR branch, request Codex review from the repository owner, and
   iterate until every required check is green and all review threads are
   resolved.
