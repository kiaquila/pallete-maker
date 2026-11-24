# Plan — 027

1. Preserve the Dependabot-generated immutable SHA updates in the three affected
   workflow files.
2. Add complete feature memory for the infrastructure-only update so repository
   policy can evaluate it normally.
3. Run repository validation and the static build locally.
4. Push the Dependabot branch, request a Codex review for the final head, and
   wait for every required check to pass.
