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
  malformed newer evidence cannot expose an older positive comment. Clean static
  approval uses original creation time; an edit cannot renew an old approval.
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

The CI dependency audit remains required. The existing fast-uri security override
requires 4.2.3 or newer; a native review pass never bypasses OSV findings.

A canonical snapshot supplies historical clocks only when every completed
section, including a companion for another SHA, is no later than the observed
comment update plus GitHub's second precision. A future companion preserves a
negative at observation time and cannot clear history or supply approval. A
legitimate carried companion may predate comment creation; only the section's
own completion must meet its existing creation lower bound. A newer canonical
clean completion for that section can recover.

An eligible canonical completed null/null lifecycle remains pending until an
independent immutable clean receipt falls inside its creation-to-completion
window, or a canonical clean own completion strictly newer than the lifecycle
observation second clears it. An unpaired null lifecycle cannot supply a
historical completion clock. A receipt
created after completion or a later formal approval cannot supply the missing
verdict. The production gate includes REST comments and enforces this pending
lifecycle before choosing between comment and formal review evidence.

If the timeline request fails, persisted REST lifecycle evidence still enforces
the pending latch before formal approval. This fallback may return only a
pending blocker or no blocker; it never supplies positive comment approval
without genuine head activation.

### Canonical calendar clocks and independent channel recovery

Native table clocks use real UTC ISO calendar dates, including native fractional
seconds. Prose dates and calendar rollover dates supply neither approval nor
historical clearance; typed findings still remain at their observed time.
Every completed section must precede the exclusive end of the observed GitHub
server second: `floor(observed / 1000) * 1000 + 1000`. A fractional observation
never widens that bucket; `.999999` within it remains valid.

A strictly newer canonical CODE FALSE/FALSE completion retires an unknown CODE
lifecycle independently of the security verdict in that snapshot. Security
findings and their later own-section clearance remain separate requirements.
A later receipt cannot replace a missing or equal-second CODE completion, and
an uncleared security finding still blocks approval.
