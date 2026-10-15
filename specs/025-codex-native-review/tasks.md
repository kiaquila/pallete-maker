# Tasks

- [x] Verify GitHub identity, refs, protection and isolated worktree.
- [x] Reproduce the receipt regression on main.
- [x] Implement strict receipt validation and actual gate integration.
- [x] Implement edited-event and active-gate recovery.
- [x] Add regression coverage and update durable docs.
- [x] Pass full preflight and publish ready-for-review PR #48.
- [ ] Obtain native Codex review for final HEAD and resolve all threads.
- [ ] Verify protected merge readiness and wait 120 seconds.
- [ ] Merge normally and confirm GitHub result.

Native review of the initial implementation completed without findings. The
connector ignored both requests for a legacy/formal bootstrap result and emitted
v1 receipts only. The existing required gate therefore remains red until a
trusted deployment path is available; no bypass or policy change was used.
The subsequent native review identified P1: GitHub may append `@ref` to the
workflow path. Normalize the path before matching and exercise completion
reconciliation with branch, pull-request and commit refs. Final-head acceptance
and merge evidence are recorded on
[PR #48](https://github.com/kiaquila/pallete-maker/pull/48).

A later P2 identified retracted evidence hidden by the workflow body filter.
Route bot edits through runtime identity validation and reconcile all trusted
Codex comment updates on completion, including bodies that lost their markers.
Such edits must invalidate older positive evidence without granting a verdict.
