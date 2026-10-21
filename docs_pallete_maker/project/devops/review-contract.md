# Review Contract

> Audience: all agents. **Canonical source** for: per-backend review output format, severity rules, `AI_REVIEW_OUTCOME` schema. Prereq: `ai-orchestration-protocol.md` (agent routing). Sibling: `review-trigger-automation.md` (trigger mechanics).

## Backend Trigger Constraints (summary)

All three backends reject bot-posted trigger comments. A human-authored trigger is required:

- on **every new push** (`pull_request: synchronize`) for any backend, and
- on **PR open** for `codex` and `claude` — only Gemini Code Assist auto-reviews on `opened` / `ready_for_review`. With `AI_REVIEW_AGENT=codex` (current default), the initial `AI Review` run fails quickly without evidence; a human must post `@codex review <full-head-sha>` after opening the PR.

Full backend matrix and mitigation Tiers: see `review-trigger-automation.md`. Canonical recovery: `pnpm run review:switch -- --to <agent>`.

## Codex Review (current default)

- Current default review backend, used when `AI_REVIEW_AGENT=codex`
- Native GitHub PR review surface from `chatgpt-codex-connector[bot]`
- Inline findings must carry `P0` to `P3`
- `P3`-only findings are advisory
- `P0` to `P2` findings block merge, including findings published in the
  formal review body when GitHub cannot attach an inline comment. Untagged
  machine-marked body findings fail closed; a suggestions body without readable
  severity cannot be treated as an empty no-findings review.
- In `trigger_mode=skip`, formal reviews with `commit_id === headSha`
  stay authoritative.
- Summary-only / setup-error comments are accepted only when they land
  after the current head's PR timeline activation event, and after the
  newest same-head human `@codex review` trigger if one exists.
- Accept legacy `Codex Review:` no-findings replies and the native
  `<!-- codex-review-receipt:v1 -->` format from
  `chatgpt-codex-connector[bot]` only. A receipt requires exactly one positive
  verdict and one `**Reviewed commit:**` line. Match the current full SHA,
  resolving a 10–39 character abbreviation through GitHub before success.
  Reject missing/stale SHAs, duplicate markers, conflicting text and incomplete
  verdicts. Known connector sign-offs and emoji are allowed after the explicit
  no-findings sentence; unknown or contradictory prose fails closed. Only the
  known About Codex details block may follow the verdict. The observed `Bravo.`
  presentation sign-off is accepted; unknown or contradictory prose is pending.
- Formal review edits and dismissals must re-evaluate the check. Trusted
  `ai-review-edit:v1` records supply ordering only, bound to the full head,
  selected agent, review ID and exact current body/state hash. They cannot
  manufacture a native verdict. A retracted formal verdict becomes pending;
  every same-head native P0-P2 or untagged formal body finding remains blocking.
  All submitted current-head native reviews remain candidates even after their
  verdict text is removed. On equal-second timestamps, a non-passing comment or
  formal verdict takes precedence over a passing counterpart, including ties
  between multiple formal reviews regardless of REST list order.
- Pick the freshest formal review or eligible receipt using edit timestamps;
  malformed newer evidence cannot expose an older positive comment. A receipt
  edited after the current trusted trigger may be reused even if created earlier.
- Before success, inspect all review-thread pages for unresolved native Codex
  P0–P2 or untagged findings, including older heads. New request markers never
  erase them; P3-only findings remain advisory. Re-read the PR head immediately
  before publishing success and fail if it changed or the PR closed.
- Official `codex-pull-request-review-summary` / `codex-review-state:v1` snapshots
  may supply proof only under the strict native-state contract below. A heading,
  `Completed` text or reaction alone never supplies a verdict.
- If the timeline lookup is unavailable, the gate logs a warning and
  fails closed by waiting for formal review only. If review-thread proof is
  unavailable, no Codex result may pass.

## Gemini Review

- Alternative review backend, used when `AI_REVIEW_AGENT=gemini`
- Native GitHub PR review surface from `gemini-code-assist[bot]`
- Inline findings are expected to carry `Critical`, `High`, `Medium`, or `Low`
- `Low`-only findings are advisory
- `Critical`, `High`, and `Medium` findings block merge

## Claude Review (currently non-operational)

Retained for schema reference only. The `claude-review.yml` workflow is dead
code pending cleanup; `ANTHROPIC_API_KEY` is not configured and the local
runner was rolled back. Do not select `AI_REVIEW_AGENT=claude` until restored.

Schema (when operational):

- Triggered by a human posting `@claude review once` on the PR
- Final result is a top-level comment, not a formal GitHub review state
- The comment must start with:

```text
AI_REVIEW_AGENT: claude
AI_REVIEW_SHA: <head sha>
AI_REVIEW_OUTCOME: pass|advisory|block
```

- `pass` and `advisory` are non-blocking
- `block` is merge-blocking

## Repository Focus

For `pallete-maker`, reviewers should prioritize:

- mobile palette grid reflow regressions
- LCH harmony rules correctness (checkHarmony/hueDiff logic)
- PNG export safety (html2canvas invocation, offscreen container)
- RU UI copy consistency
- build/deploy safety
- CDN supply-chain risks (chroma-js, html2canvas, Tailwind)
- maintainability risks in the static app

## Strict native structured state

Modern connector replies can vary their friendly closing without changing the
review verdict. The gate therefore accepts the connector's official mutable
summary as independent proof, rather than interpreting arbitrary closing prose.
Standalone legacy replies and receipts retain their strict verdict rules.

A trusted `chatgpt-codex-connector[bot]` summary must contain exactly one supported
summary marker and one compact `codex-review-state:v1` JSON object. The closed
schema requires exactly `code_review` and `security_review`, each with exactly
`commit_sha`, `has_any_findings`, `has_unresolved_findings` and `status`. Code
review must bind the full current 40-character SHA, have status `completed`, and
both flags must be boolean `false`. Security must either have all four fields
`null`, or independently satisfy the same current-head clean condition. Duplicate
keys, unknown keys/versions, wrong types, partial security state and stale SHAs
remain pending. The matching native visible review table is required; extra or
contradictory visible text, stale commits and unknown help content fail closed.

The visible code-row completion datetime is required and must follow both the
current head activation and latest request boundary. Security-only summary edits
cannot refresh an older code verdict. The snapshot's `updated_at` must also follow
the same boundary; an older creation can qualify only through a fresh edit.
Clean snapshot ordering uses its actual code completion time, conservatively
bucketed to GitHub seconds. Completion in a request, activation, receipt or
formal-withdrawal second cannot prove a later review. A security-only
edit cannot reorder that code verdict after a later unknown receipt. Completion
must not exceed the comment update clock (allowing GitHub second truncation).
Invalid snapshots use their mutable update time as conservative veto signals.
The latest summary supersedes older clean state even when malformed, negative,
for another head or still running. A non-passing snapshot wins timestamp ties.
No timeline means no structured-state approval.

Unknown receipt closings remain pending evidence under the existing strict
receipt parser. A later strict completed-clean snapshot may supersede that
receipt; an unknown receipt arriving after a clean snapshot makes the result
pending again. On equal timestamps, non-passing evidence wins. Request a fresh
native review when the connector publishes ambiguous evidence last. This keeps
future neutral phrases independent of a positive suffix allowlist without
interpreting arbitrary prose or weakening contradictory-finding invalidation.
Malformed envelopes, extra lines, duplicate metadata, unsupported footers and
explicit negative/provisional findings retain their normal invalidating role.
Native P0–P2 findings, unresolved threads, formal retractions, abbreviated receipt
SHA resolution and final-head checks keep their existing blocking rules.

Static clean receipts use immutable creation time for approval ordering and current-request/head freshness. Editing a receipt cannot renew approval; unknown, pending and negative edits retain update time to invalidate older proof. Strict structured approvals continue to use code-row completion time.

A fresh unedited static receipt at the same timestamp second as a request or head activation may use observed timeline order after that boundary. Edited or unordered equal-second receipts remain pending.

Strict valid same-head structured finding flags persist per section across repeated review requests. Only a strictly newer canonical completed false/false result for the affected section clears them. Security null and later code-only/formal/static approvals cannot clear security findings; equal-second evidence stays blocked. Malformed and untrusted historical snapshots cannot create a permanent latch.

Completed negative state uses the affected section’s canonical completion clock for ordering and clearing. Edits to another section cannot renew that negative verdict; running or invalid completion clocks retain the observed comment timestamp fallback.

The history guard covers strict snapshots present in the current REST issue-comment/timeline response. GitHub exposes only the current body of a mutable comment; this contract does not retain unseen prior revisions. Lifecycle fixtures use distinct persisted comment IDs. Native inline findings and unresolved review-thread guards remain authoritative. Durable webhook revision capture is outside this change.

Historical negative latching and clearing match the affected section’s exact head and canonical row independently of the other section’s head. This partial historical evidence never grants whole-PR approval or suppresses current pending signals.

Historical negative snapshots accept multiline machine JSON and presentation-only nonprotocol HTML comments, retaining a unique leading protocol envelope, closed fields, duplicate-key rejection and exact affected-section head. Canonical visible rows provide section clocks; complete-body validation remains required for approval and clearing. This formatting tolerance never grants affirmative review authority.

Protocol-marker uniqueness counts actual HTML comment markers, not bare marker words in the supported visible review-trigger text.

Negative completion ordering considers only affected sections bound to the current full head. Protocol marker lines indented as Markdown code (four spaces or a tab) are examples, not live structured snapshots.

History validation preserves nonprotocol HTML comments on Markdown code-indented lines; those snapshots cannot clear earlier findings. Unindented presentation metadata remains supported.

Negative history uses a strict leading official summary marker, closed typed JSON and exact summary heading. Once that envelope proves an explicit current-head finding, later presentation cannot erase it, including quoted examples or trailing markers. Coherent canonical section rows retain their completion clocks; otherwise the observation time applies. Duplicate or malformed metadata before the heading remains invalid. Clean approval and historical clearing always require strict validation of the original complete body.

The leading negative boundary recognizes the supported one-to-three-space Markdown heading indentation. An explicit “Do not merge” in the visible trigger cell is contradictory and cannot supply canonical approval or historical clearing evidence; ordinary scheduled and security trigger text remains supported.

Canonical summary headings allow zero to three leading spaces; four spaces or a tab cannot supply authority. Trigger contradiction checks normalize inline Markdown emphasis/links and character entities, so rendered “Do not merge” remains contradictory.

Known P0–P2 severity and “Do not merge” contradictions are checked on normalized visible presentation, including numeric character entities and inline emphasis. Machine metadata, SHA and time validation continues to use the original raw values.

A duplicate visible canonical section row makes negative-history completion clocks ambiguous, including accepted leading-space indentation. The explicit finding remains, ordered by observed update time. Hidden comment rows cannot provide completion clocks.

Heading validation also checks the effective line after presentation-comment removal: an embedded BOM or comment-prefixed code indentation cannot become live Markdown through trimming. Removing ordinary HTML comments preserves line breaks, preventing split row fields from joining into a canonical completion. Visible contradiction normalization includes standard HTML whitespace entity names; protocol markers, machine JSON, hashes and completion timestamps remain raw.

Decoded Unicode format characters are removed only for visible contradiction checks, so zero-width formatting cannot hide a rendered P0–P2 warning. Machine data and completion-row parsing are unchanged.

Raw protocol indentation detection includes a BOM between indentation and the marker. Visible format characters are checked both as removed characters and word separators, including standard named zero-width entities, preserving existing priority and merge-warning detection without normalizing machine evidence.

Visible contradiction projection uses the Unicode Default_Ignorable_Code_Point category, covering variation selectors as well as format characters. A rendered priority warning cannot be hidden by these characters; raw machine evidence remains unchanged.

Visible link labels are projected with balanced destination parentheses before known contradiction checks. Negative completion-clock reuse requires the complete visible table row count to match the active sections; an extra rendered inactive-companion row retains the typed finding at observation time rather than borrowing an older completion.

The original summary-marker and heading lines must have canonical ASCII indentation (zero to three spaces) before any trimming or presentation-comment removal. Other raw prefix characters cannot be normalized into protocol or Markdown authority.
