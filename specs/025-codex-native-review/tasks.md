# Tasks

**Status: COMPLETE.** Implementation, protected merge and production smoke are
complete. The production PNG checks used desktop and mobile browser viewports;
physical-device coverage is outside this smoke result.

- [x] Verify GitHub identity, refs, protection and isolated worktree.
- [x] Reproduce the receipt regression on main.
- [x] Implement strict receipt validation and actual gate integration.
- [x] Implement edited-event and active-gate recovery.
- [x] Add regression coverage and update durable docs.
- [x] Pass full preflight and publish ready-for-review PR #48.
- [x] Obtain native Codex review for final HEAD and resolve all threads.
- [x] Verify protected merge readiness and wait 120 seconds.
- [x] Merge normally and confirm GitHub result.
- [x] Verify production PNG downloads on desktop and mobile viewports, inspect both images and preserve the evidence.

## Completion evidence

- [PR #48](https://github.com/kiaquila/pallete-maker/pull/48) merged normally on
  2026-10-15 at 23:22:52 UTC. Reviewed head:
  `91854434c15948d689c407e3137c9677753983ad`; production merge commit:
  `d72989a7a41b6c0c8e5bb27027329eb2f0127fa5`.
- Final native review had no findings; all five review threads were resolved.
  Required checks were green, with a verified 175-second stability window before
  merge. Full preflight passed, including 145 tests.
- Vercel production deployment succeeded. Desktop (1440 × 900) and mobile
  (390 × 844) viewport exports both downloaded valid, visually correct PNGs.
  The two files are byte-for-byte identical. See the
  [production smoke record and saved artifacts](../../docs_pallete_maker/project/devops/delivery-playbook.md#pr-48--complete)
  for dimensions, checksums and the mobile coverage limit.

## Review history

Native review of the initial implementation completed without findings. The
connector ignored both requests for a legacy/formal bootstrap result and emitted
v1 receipts only. This initially left the existing required gate red until a
trusted deployment path became available; no bypass or policy change was used.
The final passing checks and protected merge above supersede that initial blocker.
The subsequent native review identified P1: GitHub may append `@ref` to the
workflow path. Normalize the path before matching and exercise completion
reconciliation with branch, pull-request and commit refs. Final-head acceptance
and merge evidence are recorded on
[PR #48](https://github.com/kiaquila/pallete-maker/pull/48).

A later P2 identified retracted evidence hidden by the workflow body filter.
Route bot edits through runtime identity validation and reconcile all trusted
Codex comment updates on completion, including bodies that lost their markers.
Such edits must invalidate older positive evidence without granting a verdict.

A native P2 in formal review 5540814051 identified second-precision timestamp
ambiguity. Treat equality with the attempt start conservatively and stop after
a newer attempt has observed the evidence. Also preserve severity when a native
finding is published directly in the formal review body without an inline thread.

Native P1 in review 5540858298 identified formal review edits that could leave a
previously successful check green. Subscribe to edits and dismissals, and record
stable event-run ordering through a trusted, exact-body-bound Actions marker.
Exercise successful and active gates, completion reconciliation, duplicate
handling, spoofing/mismatch rejection and formal verdict retraction. The marker
is ordering metadata only; same-head native body findings remain blocking.

Native P1 in review 5540952034 identified webhook/REST state case differences.
Canonicalize state before hashing and exercise lowercase event payloads against
uppercase REST reviews, including approval, changes requested and dismissal.

Native P2 in review 5540988151 identified a strict timestamp comparison that
excluded formal retractions in the submission second. Retain all trusted
current-head formal reviews as candidates and prefer a non-pass when comment
and formal timestamps tie. Cover older and tied positive receipts, tied
incomplete comments, conflicting formal reviews in both REST orders and the
both-positive case.

Native review on 1cb1ecf5c3ecfd56d1bbe837f1d44ba7dd41dd4a completed
without findings (receipt 6204216828). Its observed `Bravo.` sign-off exposed
another strict compatibility gap; add that exact harmless presentation phrase
without accepting arbitrary or contradictory prose. Re-review the changed head.

## Structured-state compatibility

Support unseen friendly closings through independent official structured proof,
not an open-ended prose verdict. Validate one closed-schema native v1 snapshot,
full current head, completed clean code/security state and matching visible table.
Use mutable update time and request/head boundaries; newer malformed, stale,
pending or negative state invalidates old clean state, including timestamp ties.
Keep standalone receipts strict: unknown later/equal receipts stay pending until
a newer strict clean summary. Preserve exact SHA resolution and finding vetoes. Preserve blocking threads, formal
review and final-head checks. Regression coverage exercises actual gates, both
arrival orders, schemas, freshness, spoofing, contradictions and native blockers.
Run full preflight and obtain current-head native review before protected merge.

Static clean receipts use immutable creation time for approval ordering and current-request/head freshness. Editing a receipt cannot renew approval; unknown, pending and negative edits retain update time to invalidate older proof. Strict structured approvals continue to use code-row completion time.
