# Plan

1. Reproduce legacy acceptance and receipt rejection on fresh main.
2. Validate receipts and select fresh evidence in the live gate; retain formal reviews and block unresolved findings.
3. Route receipt, summary and formal review edits/dismissals; durably record exact-body formal ordering from the trusted event run; reconcile evidence on gate completion without rerun loops.
4. Exercise helpers, actual gate and workflow routing; run full preflight.
5. Publish one PR, request native Codex review from the owner account, resolve findings, verify a safe bootstrap, and merge after green checks and a 120-second stability window.

## Modern state implementation

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

Strict valid same-head structured finding flags latch per review section across repeated requests. Only a strictly newer canonical completed false/false result for that section clears its latch; security null, code-only/formal/static positives and equal-second completions cannot clear security findings. Malformed or untrusted history does not create permanent latches.

Historical negative snapshots accept multiline machine JSON and presentation-only nonprotocol HTML comments, retaining unique protocol markers, closed fields, duplicate-key rejection, exact affected-section head and visible-row validation. This formatting tolerance never grants affirmative review authority.
