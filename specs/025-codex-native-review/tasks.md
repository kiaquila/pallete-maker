# Tasks

**Current follow-up: IN PROGRESS (PR #55).** The earlier PR #48 implementation,
protected merge and production smoke below are complete. Its PNG checks used
desktop and mobile browser viewports; physical-device coverage is outside that
historical smoke result.

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

## Closed native evidence contract

A structured summary proves completion only when its unique leading official
markers contain closed, duplicate-free typed JSON for the full current head and
its complete native body matches the supported heading, introduction, contiguous
four-column table, canonical section rows and exact optional service help footer.
Both observed triggers, `Manual request` and `PR opened`, are supported. Unknown
prose, arbitrary links, HTML or Markdown variants remain pending; the gate does
not try to interpret general English or reproduce GitHub Markdown rendering.

An explicit current-head TRUE finding from a valid leading envelope survives
unknown presentation at the server observation time. Only a complete canonical
body may supply section completion clocks or clear history. Clocks must fall
between the original comment creation and observed update, using GitHub's whole
second precision. A carried companion row may precede the comment's creation,
but cannot grant authority to its own section. Strict newer canonical clean
completion clears only the matching finding section; independent security
findings, malformed envelopes, timestamp ties, formal findings and unresolved
threads retain their existing safeguards.

The receipt parser recognizes the 19 observed native closing phrases recorded
with provenance in `tests/fixtures/native-codex-corpus.json`. A receipt still
requires one explicit no-major-issues verdict, one current-head SHA line, exact
optional native help content and at most one exact trailing native task link.
Unknown closings remain pending until a newer independent canonical clean
summary supplies proof. Clean static replies retain immutable creation time;
editing an old reply cannot renew approval. Abbreviated SHAs are resolved through
GitHub before success. Legacy unbound replies require trusted timeline ordering.

A canonical completed code lifecycle with null/null finding flags never grants
approval alone. It may accompany an independently clean, immutable SHA-bound
receipt created after the current trusted request and before that completion.
Running or active security, mixed flags, negative flags, edited receipts and
unknown presentation retain their pending/negative effect.

The history guard evaluates snapshots present in the current REST timeline.
GitHub exposes only current mutable comment bodies; unseen revisions are not
stored by this change. Native formal and inline finding safeguards remain
independent. Trusted human requests still require OWNER, MEMBER or COLLABORATOR
association and a non-bot identity. Full preflight, native current-head review,
green required checks and a stable 120-second window precede ordinary merge.

## Current PR #55 follow-up

- [x] Replace open-ended prose/rendering interpretation with closed native proof.
- [x] Preserve Palette-specific trust, SHA resolution and section-history rules.
- [x] Exercise real native receipts and null lifecycle/receipt chronology.
- [x] Pass the full current preflight (490 tests) and feature-memory check.
- [ ] Obtain native review and green checks for the final current SHA.
- [ ] Merge normally after 120 seconds of stability and verify main/deployment.

Current OSV validation also requires transitive `fast-uri >=4.2.3`; the final
lockfile must exclude vulnerable 4.2.2 (GHSA-w74x-v6f9-j3xg and related advisories).
