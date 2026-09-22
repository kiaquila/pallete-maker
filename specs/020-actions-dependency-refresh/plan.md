# Plan — 020

1. Preserve the Dependabot-generated immutable SHA updates in the three
   affected workflow files.
2. Add this feature-memory folder so the repository guard can evaluate the
   infrastructure-only update under the normal delivery contract.
3. Run repository validation and build locally.
4. Push the same PR branch, request a fresh Codex review for the new head, and
   wait for every required check to pass.
