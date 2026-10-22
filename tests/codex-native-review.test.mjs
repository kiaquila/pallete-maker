import {
  cleanStateBody,
  presentationReceipt,
} from "./fixtures/codex-state.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createNativeReviewEditMarker,
  extractNativeReviewEditMarker,
  nativeReviewTimestamp,
  nativeReviewBodyHash,
  classifyCodexSummaryComment,
  matchesCodexSummaryComment,
  pickAuthoritativeCodexSkipModeComment,
} from "../scripts/ai-review-helpers.mjs";

const helpFooter =
  '<details> <summary>ℹ️ About Codex in GitHub</summary>\n<br/>\n\n[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you\n- Open a pull request for review\n- Mark a draft as ready\n- Comment "@codex review".\n\nIf Codex has suggestions, it will comment; otherwise it will react with 👍.\n\n\n\n\nCodex can also answer questions or update the PR. Try commenting "@codex address that feedback".\n            \n</details>';

const HEAD = "2667f79cd7676ff331730cabf661d38dbbcddb0d";
const OLD = "b".repeat(40);
const BOT = "chatgpt-codex-connector[bot]";
const receipt = readFileSync(
  new URL("./fixtures/codex-review-receipt.txt", import.meta.url),
  "utf8",
).trim();
const legacy = "Codex Review: Didn't find any major issues. Nice work!";
const comment = (body = receipt, extra = {}) => ({
  id: 12,
  event: "commented",
  body,
  user: { login: BOT },
  created_at: "2026-10-15T10:02:00Z",
  html_url: "https://example.com/receipt",
  ...extra,
});
const activation = { event: "committed", sha: HEAD };
const trigger = {
  event: "commented",
  body: `@codex review ${HEAD}`,
  user: { login: "kiaquila", type: "User" },
  author_association: "OWNER",
  created_at: "2026-10-15T10:01:00Z",
};
const timeline = (c) => [activation, trigger, c];
const verdict = (c) => classifyCodexSummaryComment(c, HEAD).outcome;

for (const [name, body] of [
  ["real v1 receipt", receipt],
  ["legacy", legacy],
  [
    "legacy with explicit full SHA",
    `${legacy}\n\n**Reviewed commit:** \`${HEAD}\``,
  ],
]) {
  test(`accepts ${name} from the native identity`, () =>
    assert.equal(verdict(comment(body)), "pass"));
}

for (const signoff of [
  ":+1:",
  "Breezy!",
  "Bravo.",
  "Can't wait for the next one!",
  "Chef's kiss.",
  "Delightful!",
  "Hooray!",
  "Keep them coming!",
  "More of your lovely PRs please.",
  "What shall we delve into next?",
  "You're on a roll.",
]) {
  test(`accepts observed native sign-off: ${signoff}`, () => {
    assert.equal(
      verdict(comment(receipt.replace(":rocket:", signoff))),
      "pass",
    );
  });
}

const invalid = {
  "stale SHA": receipt.replace(HEAD.slice(0, 10), OLD.slice(0, 10)),
  "wrong full SHA with matching prefix": receipt.replace(
    HEAD.slice(0, 10),
    `${HEAD.slice(0, 10)}${"0".repeat(30)}`,
  ),
  "missing SHA": receipt.replace(/\n\n\*\*Reviewed commit:\*\* `[^`]+`/, ""),
  "too-short SHA": receipt.replace(HEAD.slice(0, 10), HEAD.slice(0, 7)),
  "duplicate receipt marker": `${receipt}\n<!-- codex-review-receipt:v1 -->`,
  "unsupported marker": receipt.replace("receipt:v1", "receipt:v2"),
  "malformed marker": receipt.replace("v1 -->", "v1-->"),
  "marker with incorrect whitespace": receipt.replace(
    "codex-review-receipt:",
    "codex-review-receipt :",
  ),
  "duplicate SHA": receipt.replace(
    "\n\n<details>",
    `\n\n**Reviewed commit:** \`${OLD}\`\n\n<details>`,
  ),
  "conflicting text": receipt.replace(
    " :rocket:",
    " :rocket: But P1 issues remain.",
  ),
  "negative verdict": receipt.replace(
    "Didn't find any major issues.",
    "Found blocking issues.",
  ),
  "incomplete verdict": receipt.replace(
    "Didn't find any major issues.",
    "Review in progress.",
  ),
  "bare completion": "Codex Review: Completed 👍",
  "quoted positive": `Codex Review: Found a P1 issue. Quoted previous reply: ${legacy}`,
  "unrecognized HTML": receipt.replace("<details>", "<aside>"),
  "conflicting structured marker": `${receipt}\n<!-- codex-review-state:v1 {} -->`,
};
for (const [name, body] of Object.entries(invalid)) {
  test(`rejects ${name}`, () =>
    assert.equal(verdict(comment(body)), "pending"));
}
test("rejects author spoofing and unproven current head", () => {
  assert.equal(
    verdict(comment(receipt, { user: { login: "kiaquila" } })),
    "pending",
  );
  assert.equal(
    classifyCodexSummaryComment(comment(), undefined).outcome,
    "pending",
  );
});
test("an incomplete structured summary never grants a passing verdict", () => {
  const body =
    '<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {"code_review":{"commit_sha":"' +
    HEAD +
    '","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"}} -->\n## Codex Review Summary\nCompleted 👍';
  assert.equal(matchesCodexSummaryComment(comment(body)), true);
  assert.equal(verdict(comment(body)), "pending");
});
test("a new malformed receipt cannot expose an older successful reply", () => {
  const result = pickAuthoritativeCodexSkipModeComment({
    headSha: HEAD,
    timelineEvents: [
      ...timeline(comment(legacy)),
      comment(invalid["missing SHA"], { created_at: "2026-10-15T10:03:00Z" }),
    ],
  });
  assert.equal(result.classification.outcome, "pending");
});
test("an unrecognized newer connector reply cannot expose an older pass", () => {
  const result = pickAuthoritativeCodexSkipModeComment({
    headSha: HEAD,
    timelineEvents: [
      ...timeline(comment(legacy)),
      comment("Review incomplete", { created_at: "2026-10-15T10:03:00Z" }),
    ],
  });
  assert.equal(result.classification.outcome, "pending");
});
test("an edit cannot renew a receipt or legacy approval from before the trigger", () => {
  const edited = comment(receipt, {
    created_at: "2026-10-14T10:00:00Z",
    updated_at: "2026-10-15T10:02:00Z",
  });
  assert.equal(
    pickAuthoritativeCodexSkipModeComment({
      headSha: HEAD,
      timelineEvents: [edited, activation, trigger],
    }).classification.outcome,
    "pending",
  );
  assert.equal(
    pickAuthoritativeCodexSkipModeComment({
      headSha: HEAD,
      timelineEvents: [{ ...edited, body: legacy }, activation, trigger],
    }).classification.outcome,
    "pending",
  );
});

function runGate({
  comments = timeline(comment()),
  reviews = [],
  threads = [],
  initialHead = HEAD,
  finalHead = HEAD,
  resolvedSha = HEAD,
  reviewComments = [],
  issueComments = [],
  timelineUnavailable = false,
  threadErrors = false,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "codex-gate-test-"));
  try {
    writeFileSync(join(dir, "event.json"), "{}");
    writeFileSync(
      join(dir, "data.json"),
      JSON.stringify({
        comments,
        reviews,
        threads,
        initialHead,
        finalHead,
        resolvedSha,
        reviewComments,
        issueComments,
        timelineUnavailable,
        threadErrors,
      }),
    );
    writeFileSync(
      join(dir, "fetch.mjs"),
      `
      import { readFileSync } from 'node:fs';
      const d=JSON.parse(readFileSync(${JSON.stringify(join(dir, "data.json"))},'utf8'));
      let pulls=0;
      globalThis.fetch=async (url, init={}) => {
        const path=new URL(url).pathname;
        let data;
        if(path.endsWith('/pulls/7')) data={state:'open',head:{sha:++pulls===1?d.initialHead:d.finalHead}};
        else if(path.endsWith('/reviews')) data=d.reviews;
        else if(path.endsWith('/timeline')) {
          if(d.timelineUnavailable) return new Response('unavailable',{status:503});
          data=d.comments;
        }
        else if(path.includes('/commits/')) data={sha:d.resolvedSha};
        else if(path.endsWith('/graphql')) data=d.threadErrors?{errors:[{message:'denied'}]}:{data:{repository:{pullRequest:{reviewThreads:{nodes:d.threads,pageInfo:{hasNextPage:false}}}}}};
        else if(path.endsWith('/issues/7/comments')) data=d.issueComments;
        else if(path.endsWith('/comments')) data=d.reviewComments;
        else throw new Error('Unexpected request '+path);
        return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
      };
    `,
    );
    return spawnSync(
      process.execPath,
      ["--import", join(dir, "fetch.mjs"), "scripts/ai-review-gate.mjs"],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env,
          GITHUB_TOKEN: "fixture",
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_EVENT_PATH: join(dir, "event.json"),
          GITHUB_OUTPUT: join(dir, "output"),
          GITHUB_STEP_SUMMARY: join(dir, "summary"),
          AI_REVIEW_AGENT: "codex",
          AI_REVIEW_PR_NUMBER: "7",
          AI_REVIEW_HEAD_SHA: HEAD,
          AI_REVIEW_TRIGGER_MODE: "skip",
          AI_REVIEW_WAIT_MS: "300",
          AI_REVIEW_POLL_MS: "10",
        },
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const formal = (extra = {}) => ({
  id: 4,
  commit_id: HEAD,
  user: { login: BOT },
  submitted_at: "2026-10-15T10:03:00Z",
  state: "COMMENTED",
  body: "Codex Review",
  html_url: "https://example.com/review",
  ...extra,
});
const thread = (body, isResolved = false) => ({
  isResolved,
  comments: {
    nodes: [
      {
        author: { login: "chatgpt-codex-connector" },
        body,
        url: "https://example.com/finding",
      },
    ],
    pageInfo: { hasNextPage: false },
  },
});
test("actual gate accepts receipt and legacy, resolves abbreviated commit, and preserves formal review", () => {
  for (const options of [
    {},
    { comments: timeline(comment(legacy)) },
    { comments: [], reviews: [formal()] },
  ]) {
    const result = runGate(options);
    assert.equal(result.status, 0, result.stderr);
  }
});
test("actual gate fails closed on stale, absent, spoofed and contradictory receipt evidence", () => {
  for (const c of [
    comment(invalid["stale SHA"]),
    comment(invalid["missing SHA"]),
    comment(receipt, { user: { login: "random[bot]" } }),
    comment(invalid["conflicting text"]),
  ]) {
    const result = runGate({ comments: timeline(c) });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /timed out/);
  }
});
test("actual gate rejects abbreviated SHA resolving to another full commit", () => {
  assert.match(runGate({ resolvedSha: OLD }).stderr, /does not resolve/);
});
test("actual gate refuses stale initial head and a concurrent push before success", () => {
  assert.match(runGate({ initialHead: OLD }).stderr, /refuses stale head/);
  assert.match(runGate({ finalHead: OLD }).stderr, /head changed/);
});
test("a new request or receipt does not remove unresolved P0-P2 or untagged findings on older heads", () => {
  for (const body of [
    "[P0] blocker",
    "[P1] blocker",
    "[P2] blocker",
    "Missing severity",
    "P3 then P1 blocker",
  ]) {
    assert.match(
      runGate({ threads: [thread(body)] }).stderr,
      /Unresolved Codex finding/,
    );
  }
  assert.equal(
    runGate({ threads: [thread("[P3] advisory"), thread("[P1] fixed", true)] })
      .status,
    0,
  );
});
test("newer negative or incomplete receipt cannot be masked by an older formal pass", () => {
  assert.notEqual(
    runGate({
      comments: timeline(
        comment(invalid["incomplete verdict"], {
          created_at: "2026-10-15T10:04:00Z",
        }),
      ),
      reviews: [formal()],
    }).status,
    0,
  );
});
test("formal changes requested and P2 findings remain blocking, P3 remains advisory", () => {
  assert.match(
    runGate({ reviews: [formal({ state: "CHANGES_REQUESTED" })] }).stderr,
    /requested changes/,
  );
  assert.match(
    runGate({
      reviews: [formal()],
      reviewComments: [{ pull_request_review_id: 4, body: "[P2] issue" }],
    }).stderr,
    /blocking findings/,
  );
  assert.equal(
    runGate({
      reviews: [formal()],
      reviewComments: [{ pull_request_review_id: 4, body: "[P3] issue" }],
    }).status,
    0,
  );
});
test("unavailable thread proof fails closed; unavailable timeline retains formal support", () => {
  assert.match(
    runGate({ threadErrors: true }).stderr,
    /Could not verify unresolved/,
  );
  assert.notEqual(runGate({ timelineUnavailable: true }).status, 0);
  assert.equal(
    runGate({ timelineUnavailable: true, reviews: [formal()] }).status,
    0,
  );
});

test("actual gate retracts an edited receipt instead of exposing an older formal pass", () => {
  const withdrawn = comment("Result withdrawn", {
    created_at: "2026-10-14T10:00:00Z",
    updated_at: "2026-10-15T10:04:00Z",
  });
  for (const comments of [
    [withdrawn, activation, trigger],
    [activation, trigger, withdrawn],
  ]) {
    const result = runGate({ comments, reviews: [formal()] });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /timed out/);
  }
});

test("formal body findings never pass as an empty comment review", () => {
  for (const priority of ["P0", "P1", "P2"]) {
    const body = `<!-- codex-code-review-finding:v1 -->\n### Codex Review\n![${priority} Badge](https://example.com/badge) Actual finding`;
    assert.match(
      runGate({ comments: [], reviews: [formal({ body })] }).stderr,
      /Blocking or untagged/,
    );
  }
  assert.match(
    runGate({
      comments: [],
      reviews: [
        formal({
          body: "<!-- codex-code-review-finding:v1 -->\nCodex Review: actual untagged finding",
        }),
      ],
    }).stderr,
    /Blocking or untagged/,
  );
  assert.notEqual(
    runGate({
      comments: [],
      reviews: [
        formal({
          body: "Codex Review: Here are some automated review suggestions",
        }),
      ],
    }).status,
    0,
  );
  assert.equal(
    runGate({
      comments: [],
      reviews: [
        formal({
          body: "<!-- codex-code-review-finding:v1 -->\nCodex Review: [P3] advisory",
        }),
      ],
    }).status,
    0,
  );
});

const editMarker = (review, extra = {}) => ({
  user: { login: "github-actions[bot]" },
  body: createNativeReviewEditMarker({
    agent: "codex",
    headSha: HEAD,
    review: { ...review, state: review.state.toLowerCase() },
    observedAt: "2026-10-15T10:04:00Z",
    sourceRunId: "12345",
    ...extra,
  }),
});
test("edit ordering is bound to bot identity, full head, review ID and exact current body/state", () => {
  const review = formal();
  const marker = editMarker(review);
  const original = Date.parse(review.submitted_at);
  assert.equal(
    nativeReviewTimestamp(review, [marker], "codex", HEAD),
    Date.parse("2026-10-15T10:04:00Z"),
  );
  for (const c of [
    { ...marker, user: { login: "kiaquila" } },
    editMarker(review, { headSha: OLD }),
    editMarker({ ...review, id: 99 }),
    editMarker({ ...review, body: "different body" }),
    editMarker({ ...review, state: "APPROVED" }),
    editMarker(review, { agent: "gemini" }),
    {
      ...marker,
      body: marker.body.replace(
        '"agent":"codex"',
        '"agent":"gemini","agent":"codex"',
      ),
    },
    { ...marker, body: marker.body + " conflicting prose" },
    {
      ...marker,
      body: marker.body.replace(
        '"source_run_id":"12345"',
        '"source_run_id":"not-a-run"',
      ),
    },
  ]) {
    assert.equal(nativeReviewTimestamp(review, [c], "codex", HEAD), original);
  }
  assert.equal(
    extractNativeReviewEditMarker({
      ...marker,
      body: marker.body.replace("2026-10-15T10:04:00.000Z", "invalid"),
    }),
    null,
  );
  assert.notEqual(runGate({ comments: [], issueComments: [marker] }).status, 0);
});
test("an edited formal retraction becomes pending instead of exposing a newer receipt", () => {
  const review = formal({
    body: "Result withdrawn",
    submitted_at: "2026-10-15T10:00:00Z",
  });
  const result = runGate({
    reviews: [review],
    issueComments: [editMarker(review)],
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /timed out/);
});
test("same-head body blockers cannot be superseded by a newer positive receipt or ordering marker", () => {
  for (const body of [
    "Codex Review: [P1] blocker",
    "<!-- codex-code-review-finding:v1 --> Codex Review: untagged finding",
  ]) {
    const review = formal({ body, submitted_at: "2026-10-15T10:00:00Z" });
    assert.match(
      runGate({ reviews: [review], issueComments: [editMarker(review)] })
        .stderr,
      /Blocking or untagged/,
    );
  }
});

test("formal edit hashes normalize webhook and REST states while retaining body/state changes", () => {
  for (const state of [
    "COMMENTED",
    "APPROVED",
    "CHANGES_REQUESTED",
    "DISMISSED",
  ]) {
    const rest = formal({ state });
    const event = { ...rest, state: state.toLowerCase() };
    assert.equal(nativeReviewBodyHash(event), nativeReviewBodyHash(rest));
    assert.equal(
      nativeReviewTimestamp(rest, [editMarker(rest)], "codex", HEAD),
      Date.parse("2026-10-15T10:04:00Z"),
    );
    assert.notEqual(
      nativeReviewBodyHash({ ...event, body: "new body" }),
      nativeReviewBodyHash(rest),
    );
  }
});

test("same-second native formal retractions remain eligible and tied non-passes win", () => {
  const at = "2026-10-15T10:03:00Z";
  const review = formal({ body: "Result withdrawn", submitted_at: at });
  const marker = editMarker(review, { observedAt: at });
  for (const receiptAt of ["2026-10-15T10:02:00Z", at]) {
    const result = runGate({
      comments: timeline(comment(receipt, { created_at: receiptAt })),
      reviews: [review],
      issueComments: [marker],
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /timed out/);
  }
  const negativeComment = runGate({
    comments: timeline(
      comment(invalid["incomplete verdict"], { created_at: at }),
    ),
    reviews: [formal()],
  });
  assert.notEqual(negativeComment.status, 0);
  assert.equal(
    runGate({
      comments: timeline(comment(receipt, { created_at: at })),
      reviews: [formal()],
    }).status,
    0,
  );
});

test("equal-second formal verdict conflicts fail closed regardless of REST ordering", () => {
  const positive = formal({ id: 3 });
  const retracted = formal({ id: 4, body: "Result withdrawn" });
  const incomplete = formal({
    id: 5,
    body: "Codex Review: Here are some automated review suggestions",
  });
  for (const negative of [retracted, incomplete]) {
    for (const reviews of [
      [positive, negative],
      [negative, positive],
    ]) {
      assert.notEqual(runGate({ comments: [], reviews }).status, 0);
    }
  }
});

for (const ordering of ["summary-first", "receipt-first"]) {
  test(`actual gate accepts strict state with unseen closing (${ordering})`, () => {
    const snapshot = comment(cleanStateBody(HEAD), {
      id: 41,
      created_at: "2026-10-20T12:02:00Z",
    });
    const presentation = comment(presentationReceipt(HEAD), {
      id: 42,
      created_at: "2026-10-20T12:03:00Z",
    });
    if (ordering === "receipt-first") {
      snapshot.created_at = "2026-10-20T12:04:00Z";
      snapshot.body = snapshot.body.replaceAll(
        "2026-10-20T12:02:00Z",
        "2026-10-20T12:04:00Z",
      );
    }
    const events = [
      activation,
      ...(ordering === "summary-first"
        ? [snapshot, presentation]
        : [presentation, snapshot]),
    ];
    const result = runGate({ comments: events });
    if (ordering === "receipt-first")
      assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0);
  });
}

for (const scenario of ["newer-pending", "prerequest", "edited-unknown"]) {
  test(`actual gate rejects static edit renewal: ${scenario}`, () => {
    const request = {
      ...comment(`@codex review ${HEAD}`, {
        id: 79,
        created_at: "2026-10-20T12:01:00Z",
      }),
      event: "commented",
      user: { login: "kiaquila" },
      author_association: "OWNER",
    };
    const edited = comment(
      presentationReceipt(
        HEAD,
        scenario === "edited-unknown" ? "Unseen closing!" : ":rocket:",
      ),
      {
        id: 80,
        created_at:
          scenario === "newer-pending"
            ? "2026-10-20T12:02:00Z"
            : "2026-10-20T12:00:00Z",
        updated_at: "2026-10-20T12:05:00Z",
      },
    );
    const snapshot = comment(
      scenario === "newer-pending"
        ? cleanStateBody(HEAD).replaceAll(
            '"status":"completed"',
            '"status":"running"',
          )
        : cleanStateBody(HEAD),
      { id: 81, created_at: "2026-10-20T12:03:00Z" },
    );
    const events = [
      { ...activation, created_at: "2026-10-20T11:59:00Z" },
      request,
      edited,
      ...(scenario === "prerequest" ? [] : [snapshot]),
    ];
    const result = runGate({ comments: events });
    assert.notEqual(result.status, 0, result.stdout);
  });
}

const securityHistoryBody = (negative, time) =>
  cleanStateBody(HEAD, (state) => ({
    ...state,
    security_review: {
      ...state.code_review,
      has_any_findings: negative,
      has_unresolved_findings: negative,
    },
  })).replaceAll("2026-10-20T12:02:00Z", time) +
  `\n| 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="${time}">${time}</relative-time> | \`${HEAD.slice(0, 7)}\` | Manual request |`;
for (const mode of [
  "formal",
  "static",
  "security-null",
  "newer-clear",
  "ordinary-comment-clear",
  "indented-comment-clear",
  "tabbed-comment-clear",
  "uppercase-clear",
  "equal-clear",
  "old-security-clock",
  "missing-security-clock",
  "malformed-old",
  "multiline-old",
  "marker-prose-old",
  "trailing-example-old",
  "fenced-example-old",
  "quoted-fence-old",
  "spaced-heading-old",
  "contradictory-trigger-clear",
  "embedded-bom-clear",
  "comment-heading-clear",
  "mediumspace-clear",
  "hairspace-clear",
  "multiline-comment-clear",
  "zerowidth-priority-clear",
  "variation-priority-clear",
  "balanced-link-clear",
  "malformed-link-clear",
  "title-double-clear",
  "title-single-clear",
  "title-paren-clear",
  "escaped-space-clear",
  "space-destination-clear",
  "empty-destination-clear",
  "escaped-opener-clear",
  "escaped-label-closer-clear",
  "nested-link-clear",
  "found-article-repeat-clock",
  "found-html-article-repeat-clock",
  "found-word-count-repeat-clock",
  "blank-label-repeat-clock",
  "html-break-repeat-clock",
  "code-priority-repeat-clock",
  "code-warning-repeat-clock",
  "raw-html-link-repeat-clock",
  "quoted-raw-html-repeat-clock",
  "quoted-html-exit-repeat-clock",
  "list-html-exit-repeat-clock",
  "list-raw-html-repeat-clock",
  "mixed-finding-count-repeat-clock",
  "existential-finding-repeat-clock",
  "detected-finding-repeat-clock",
  "detected-article-repeat-clock",
  "reverse-container-repeat-clock",
  "unresolved-count-repeat-clock",
  "used-footnote-repeat-clock",
  "invalid-footnote-label-repeat-clock",
  "invalid-footnote-reference-repeat-clock",
  "footnote-two-space-repeat-clock",
  "footnote-four-space-repeat-clock",
  "used-footnote-four-space-repeat-clock",
  "transitive-footnote-repeat-clock",
  "footnote-destination-repeat-clock",
  "footnote-reference-destination-repeat-clock",
  "footnote-reference-title-repeat-clock",
  "bugfree-repeat-clock",
  "type7-paragraph-repeat-clock",
  "unmatched-underscore-repeat-clock",
  "unmatched-star-repeat-clock",

  "unicode-footnote-repeat-clock",
  "bug-repeat-clock",
  "not-fixed-repeat-clock",
  "not-resolved-repeat-clock",
  "unrelated-negation-repeat-clock",
  "flaw-repeat-clock",
  "worded-count-repeat-clock",
  "br-finding-repeat-clock",
  "harmless-repeat-clock",
  "benign-repeat-clock",
  "except-fixed-repeat-clock",
  "none-current-repeat-clock",
  "none-were-repeat-clock",
  "may-reappear-repeat-clock",
  "defect-repeat-clock",
  "regression-repeat-clock",
  "qualified-absence-repeat-clock",
  "security-risk-repeat-clock",
  "causes-repeat-clock",
  "exposes-repeat-clock",
  "qualified-fixed-repeat-clock",
  "regression-tests-repeat-clock",
  "not-remain-fixed-repeat-clock",
  "exception-recurred-repeat-clock",
  "regression-test-count-repeat-clock",
  "defect-report-count-repeat-clock",
  "must-fixed-repeat-clock",
  "should-fixed-repeat-clock",
  "fixed-one-repeat-clock",

  "introduces-repeat-clock",
  "creates-repeat-clock",
  "contains-repeat-clock",
  "has-finding-repeat-clock",

  "direct-reappeared-repeat-clock",
  "perfect-reappeared-repeat-clock",
  "recurred-repeat-clock",
  "reopened-repeat-clock",
  "qualified-harmless-repeat-clock",
  "already-fixed-exception-repeat-clock",
  "bare-critical-repeat-clock",
  "bare-authentication-repeat-clock",
  "most-count-repeat-clock",
  "every-count-repeat-clock",
  "numerous-count-repeat-clock",
  "no-exist-repeat-clock",
  "no-remain-repeat-clock",

  "both-count-repeat-clock",
  "many-count-repeat-clock",
  "all-count-repeat-clock",
  "still-bug-repeat-clock",
  "there-still-bug-repeat-clock",
  "have-one-repeat-clock",
  "eliminated-documented-repeat-clock",
  "center-repeat-clock",
  "exception-one-repeat-clock",
  "reappeared-repeat-clock",
  "none-exist-repeat-clock",
  "nominal-this-repeat-clock",
  "nominal-that-repeat-clock",
  "grouped-count-repeat-clock",
  "vulnerability-repeat-clock",
  "coordinated-nouns-repeat-clock",
  "colon-security-repeat-clock",
  "colon-passive-repeat-clock",
  "eliminated-repeat-clock",
  "contextual-unresolved-repeat-clock",
  "plural-persist-repeat-clock",
  "plural-outstanding-repeat-clock",
  "mixed-needed-repeat-clock",
  "got-passive-repeat-clock",
  "documented-meta-repeat-clock",
  "positive-count-zero-colon-repeat-clock",
  "indefinite-present-repeat-clock",
  "indefinite-happens-repeat-clock",
  "indefinite-exists-repeat-clock",
  "ordinary-definition-repeat-clock",
  "zero-after-colon-repeat-clock",
  "colon-count-repeat-clock",
  "emphasized-repeat-clock",
  "type7-indented-repeat-clock",

  "wrapped-numeric-repeat-clock",
  "passive-finding-repeat-clock",
  "abrupt-comment-repeat-clock",
  "abrupt-dash-comment-repeat-clock",
  "tab-list-repeat-clock",
  "footnote-transitive-reference-repeat-clock",
  "footnote-transitive-destination-repeat-clock",
  "unused-footnote-repeat-clock",
  "deep-destination-repeat-clock",
  "allzero-finding-count-repeat-clock",
  "finding-softbreak-repeat-clock",
  "raw-html-numeric-repeat-clock",
  "markdown-numeric-repeat-clock",
  "code-numeric-repeat-clock",
  "finding-blankline-repeat-clock",
  "found-html-no-repeat-clock",
  "found-html-zero-repeat-clock",
  "comment-pipe-clear",
  "inactive-numeric-row-clock",
  "inactive-nbsp-row-clock",
  "inactive-html-row-clock",
  "inactive-optional-pipe-row-clock",
  "inactive-quoted-row-clock",
  "marker-bom-clear",
  "marker-nbsp-clear",
  "zerowidth-trigger-clear",
  "namedzero-trigger-clear",
  "code-heading-space-clear",
  "code-heading-tab-clear",
  "markdown-trigger-clear",
  "entity-trigger-clear",
  "numeric-priority-clear",
  "duplicate-row-clock",
  "hidden-row-clock",
  "markdown-priority-clear",
  "numeric-trigger-clear",
  "trailing-marker-old",
  "duplicate-leading-old",
  "whole-fenced-old",
  "whole-quoted-old",
  "trailing-marker-clear",
  "quoted-fence-clear",
  "fenced-example-clear",
  "bom-space-clear",
  "bom-tab-clear",
  "warning-clear",
  "running-visible-clear",
  "example-clear",
  "indented-old",
  "tabbed-old",
  "wrong-actor",
]) {
  test(`actual gate retains section-specific security history: ${mode}`, () => {
    const old = comment(securityHistoryBody(true, "2026-10-20T12:02:00Z"), {
      id: 930,
      created_at: "2026-10-20T12:02:00Z",
    });
    if (mode === "multiline-old")
      old.body =
        "<!-- presentation-only metadata -->\n" +
        old.body.replace(
          /(codex-review-state:v1 )(\{[^\n]+\})( -->)/,
          (_, prefix, json, suffix) =>
            prefix + JSON.stringify(JSON.parse(json), null, 2) + suffix,
        );
    if (mode === "marker-prose-old")
      old.body = old.body.replaceAll(
        "Manual request",
        "codex-review-state: parser review",
      );
    if (["indented-old", "tabbed-old"].includes(mode))
      old.body = old.body.replace(
        /^(<!-- codex-(?:pull-request-review-summary|review-state)[^\n]*)/gm,
        (mode === "tabbed-old" ? "\t" : "    ") + "$1",
      );
    if (mode === "duplicate-leading-old")
      old.body = old.body.replace(
        "<!-- codex-review-state:v1",
        "<!-- codex-review-state:v1 {} -->\n<!-- codex-review-state:v1",
      );
    if (mode === "whole-fenced-old")
      old.body = "```html\n" + old.body + "\n```";
    if (mode === "whole-quoted-old")
      old.body = old.body
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");
    if (mode === "trailing-marker-old")
      old.body += "\n<!-- codex-review-state:v1 {} -->";
    if (mode === "spaced-heading-old")
      old.body =
        old.body.replace(
          "## Codex Review Summary",
          "  ## Codex Review Summary",
        ) + "\n    <!-- codex-review-state:v1 {} -->";
    if (mode === "quoted-fence-old")
      old.body += "\n> ```html\n> <!-- codex-review-state:v1 {} -->\n> ```";
    if (mode === "fenced-example-old")
      old.body += "\n```html\n<!-- codex-review-state:v1 example -->\n```";
    if (mode === "trailing-example-old")
      old.body += "\n    <!-- codex-review-state:v1 example -->";
    if (mode === "malformed-old")
      old.body = old.body.replace("state:v1", "state:v2");
    if (mode === "wrong-actor") old.user = { login: "attacker" };
    const request = {
      ...comment(`@codex review ${HEAD}`, {
        id: 931,
        created_at: "2026-10-20T12:03:00Z",
      }),
      event: "commented",
      user: { login: "kiaquila" },
      author_association: "OWNER",
    };
    const receipt = comment(presentationReceipt(HEAD, ":rocket:"), {
      id: 932,
      created_at: "2026-10-20T12:04:00Z",
    });
    const newer = comment(
      mode === "security-null"
        ? cleanStateBody(HEAD).replaceAll(
            "2026-10-20T12:02:00Z",
            "2026-10-20T12:05:00Z",
          )
        : securityHistoryBody(
            false,
            mode === "equal-clear"
              ? "2026-10-20T12:02:00Z"
              : "2026-10-20T12:05:00Z",
          ),
      { id: 933, created_at: "2026-10-20T12:05:00Z" },
    );
    if (
      [
        "ordinary-comment-clear",
        "indented-comment-clear",
        "tabbed-comment-clear",
        "uppercase-clear",
      ].includes(mode)
    )
      receipt.created_at = "2026-10-20T12:06:00Z";
    if (mode === "ordinary-comment-clear")
      newer.body += "\n<!-- TODO: presentation metadata -->";
    if (mode === "indented-comment-clear")
      newer.body += "\n    <!-- TODO: presentation metadata -->";
    if (mode === "tabbed-comment-clear")
      newer.body += "\n\t<!-- TODO: presentation metadata -->";
    if (["bom-space-clear", "bom-tab-clear"].includes(mode))
      newer.body =
        "\uFEFF" +
        newer.body.replace(
          /^<!-- codex-pull-request-review-summary/,
          (mode === "bom-tab-clear" ? "\t" : "    ") +
            "<!-- codex-pull-request-review-summary",
        );
    if (mode === "warning-clear")
      newer.body = newer.body.replace(
        "🔒 **Security Review**",
        "⚠️ 🔒 **Security Review**",
      );
    if (mode === "running-visible-clear")
      newer.body = newer.body.replaceAll(
        '"status":"completed"',
        '"status":"running"',
      );
    if (mode === "trailing-marker-clear")
      newer.body += "\n<!-- codex-review-state:v1 {} -->";
    if (["code-heading-space-clear", "code-heading-tab-clear"].includes(mode))
      newer.body = newer.body.replace(
        "## Codex Review Summary",
        (mode === "code-heading-tab-clear" ? "\t" : "    ") +
          "## Codex Review Summary",
      );
    if (mode === "embedded-bom-clear")
      newer.body = newer.body.replace(
        "## Codex Review Summary",
        "\uFEFF    ## Codex Review Summary",
      );
    if (mode === "comment-heading-clear")
      newer.body = newer.body.replace(
        "## Codex Review Summary",
        "<!-- presentation metadata -->    ## Codex Review Summary",
      );
    if (["mediumspace-clear", "hairspace-clear"].includes(mode))
      newer.body = newer.body.replaceAll(
        "Manual request",
        mode === "mediumspace-clear"
          ? "Do&MediumSpace;not&MediumSpace;merge"
          : "Do&hairsp;not&hairsp;merge",
      );
    if (mode === "marker-nbsp-clear")
      newer.body = newer.body.replace(
        /^<!-- codex-pull-request-review-summary/,
        "    \u00A0<!-- codex-pull-request-review-summary",
      );
    if (mode === "marker-bom-clear")
      newer.body = newer.body.replace(
        /^<!-- codex-pull-request-review-summary/,
        "    \uFEFF<!-- codex-pull-request-review-summary",
      );
    if (["zerowidth-trigger-clear", "namedzero-trigger-clear"].includes(mode))
      newer.body = newer.body.replaceAll(
        "Manual request",
        mode === "zerowidth-trigger-clear"
          ? "Do&#8203;not&#8203;merge"
          : "Do&ZeroWidthSpace;not&ZeroWidthSpace;merge",
      );
    if (mode === "malformed-link-clear")
      newer.body = newer.body.replaceAll(
        "Manual request",
        "[safe](P1 blocker)",
      );
    if (
      [
        "title-double-clear",
        "title-single-clear",
        "title-paren-clear",
      ].includes(mode)
    ) {
      const title =
        mode === "title-double-clear"
          ? '\"title\"'
          : mode === "title-single-clear"
            ? "'title'"
            : "(title)";
      newer.body = newer.body.replaceAll(
        "Manual request",
        `Do [not](https://example.com ${title}) merge`,
      );
    }
    if (mode === "escaped-space-clear")
      newer.body = newer.body.replaceAll(
        "Manual request",
        "[safe](P1\\ blocker)",
      );
    if (["space-destination-clear", "empty-destination-clear"].includes(mode))
      newer.body = newer.body.replaceAll(
        "Manual request",
        mode === "space-destination-clear"
          ? "Do [not]( https://example.com ) merge"
          : "Do [not]() merge",
      );
    if (mode === "escaped-opener-clear")
      newer.body = newer.body.replaceAll("Manual request", "\\[safe](P1)");
    if (mode === "escaped-label-closer-clear")
      newer.body = newer.body.replaceAll("Manual request", "[safe\\]( P1)");
    if (mode === "comment-pipe-clear")
      newer.body = newer.body.replaceAll(
        "Manual request",
        "Manual <!-- | --> request",
      );
    if (mode === "nested-link-clear")
      newer.body = newer.body.replaceAll(
        "Manual request",
        "[safe [inner](url)](P1)",
      );
    if (
      [
        "found-article-repeat-clock",
        "found-html-article-repeat-clock",
        "found-word-count-repeat-clock",
        "blank-label-repeat-clock",
        "html-break-repeat-clock",
        "code-priority-repeat-clock",
        "code-warning-repeat-clock",
        "raw-html-link-repeat-clock",
        "quoted-raw-html-repeat-clock",
        "quoted-html-exit-repeat-clock",
        "list-html-exit-repeat-clock",
        "list-raw-html-repeat-clock",
        "mixed-finding-count-repeat-clock",
        "existential-finding-repeat-clock",
        "detected-finding-repeat-clock",
        "detected-article-repeat-clock",
        "reverse-container-repeat-clock",
        "unresolved-count-repeat-clock",
        "used-footnote-repeat-clock",
        "invalid-footnote-label-repeat-clock",
        "invalid-footnote-reference-repeat-clock",
        "footnote-two-space-repeat-clock",
        "footnote-four-space-repeat-clock",
        "used-footnote-four-space-repeat-clock",
        "transitive-footnote-repeat-clock",
        "footnote-destination-repeat-clock",
        "footnote-reference-destination-repeat-clock",
        "footnote-reference-title-repeat-clock",
        "bugfree-repeat-clock",
        "type7-paragraph-repeat-clock",
        "unmatched-underscore-repeat-clock",
        "unmatched-star-repeat-clock",

        "unicode-footnote-repeat-clock",
        "bug-repeat-clock",
        "not-fixed-repeat-clock",
        "not-resolved-repeat-clock",
        "unrelated-negation-repeat-clock",
        "flaw-repeat-clock",
        "worded-count-repeat-clock",
        "br-finding-repeat-clock",
        "harmless-repeat-clock",
        "benign-repeat-clock",
        "except-fixed-repeat-clock",
        "none-current-repeat-clock",
        "none-were-repeat-clock",
        "may-reappear-repeat-clock",
        "defect-repeat-clock",
        "regression-repeat-clock",
        "qualified-absence-repeat-clock",
        "security-risk-repeat-clock",
        "causes-repeat-clock",
        "exposes-repeat-clock",
        "qualified-fixed-repeat-clock",
        "regression-tests-repeat-clock",
        "not-remain-fixed-repeat-clock",
        "exception-recurred-repeat-clock",
        "regression-test-count-repeat-clock",
        "defect-report-count-repeat-clock",
        "must-fixed-repeat-clock",
        "should-fixed-repeat-clock",
        "fixed-one-repeat-clock",

        "introduces-repeat-clock",
        "creates-repeat-clock",
        "contains-repeat-clock",
        "has-finding-repeat-clock",

        "direct-reappeared-repeat-clock",
        "perfect-reappeared-repeat-clock",
        "recurred-repeat-clock",
        "reopened-repeat-clock",
        "qualified-harmless-repeat-clock",
        "already-fixed-exception-repeat-clock",
        "bare-critical-repeat-clock",
        "bare-authentication-repeat-clock",
        "most-count-repeat-clock",
        "every-count-repeat-clock",
        "numerous-count-repeat-clock",
        "no-exist-repeat-clock",
        "no-remain-repeat-clock",

        "both-count-repeat-clock",
        "many-count-repeat-clock",
        "all-count-repeat-clock",
        "still-bug-repeat-clock",
        "there-still-bug-repeat-clock",
        "have-one-repeat-clock",
        "eliminated-documented-repeat-clock",
        "center-repeat-clock",
        "exception-one-repeat-clock",
        "reappeared-repeat-clock",
        "none-exist-repeat-clock",
        "nominal-this-repeat-clock",
        "nominal-that-repeat-clock",
        "grouped-count-repeat-clock",
        "vulnerability-repeat-clock",
        "coordinated-nouns-repeat-clock",
        "colon-security-repeat-clock",
        "colon-passive-repeat-clock",
        "eliminated-repeat-clock",
        "contextual-unresolved-repeat-clock",
        "plural-persist-repeat-clock",
        "plural-outstanding-repeat-clock",
        "mixed-needed-repeat-clock",
        "got-passive-repeat-clock",
        "documented-meta-repeat-clock",
        "positive-count-zero-colon-repeat-clock",
        "indefinite-present-repeat-clock",
        "indefinite-happens-repeat-clock",
        "indefinite-exists-repeat-clock",
        "ordinary-definition-repeat-clock",
        "zero-after-colon-repeat-clock",
        "colon-count-repeat-clock",
        "emphasized-repeat-clock",
        "type7-indented-repeat-clock",

        "wrapped-numeric-repeat-clock",
        "passive-finding-repeat-clock",
        "abrupt-comment-repeat-clock",
        "abrupt-dash-comment-repeat-clock",
        "tab-list-repeat-clock",
        "footnote-transitive-reference-repeat-clock",
        "footnote-transitive-destination-repeat-clock",
        "unused-footnote-repeat-clock",
        "deep-destination-repeat-clock",
        "allzero-finding-count-repeat-clock",
        "finding-softbreak-repeat-clock",
        "raw-html-numeric-repeat-clock",
        "markdown-numeric-repeat-clock",
        "code-numeric-repeat-clock",
        "finding-blankline-repeat-clock",
        "found-html-no-repeat-clock",
        "found-html-zero-repeat-clock",
      ].includes(mode)
    ) {
      old.body +=
        mode === "flaw-repeat-clock"
          ? "\n" +
            helpFooter.replace(
              "</details>",
              "A security flaw was found.</details>",
            )
          : mode === "worded-count-repeat-clock"
            ? "\n" +
              helpFooter.replace(
                "</details>",
                "Two security issues were found.</details>",
              )
            : mode === "br-finding-repeat-clock"
              ? "\n" +
                helpFooter.replace(
                  "</details>",
                  "A security issue<br>was found.</details>",
                )
              : mode === "harmless-repeat-clock"
                ? "\n" +
                  helpFooter.replace(
                    "</details>",
                    "The issue is harmless.</details>",
                  )
                : mode === "benign-repeat-clock"
                  ? "\n" +
                    helpFooter.replace(
                      "</details>",
                      "The issue is benign.</details>",
                    )
                  : mode === "except-fixed-repeat-clock"
                    ? "\n" +
                      helpFooter.replace(
                        "</details>",
                        "No issues or findings were found—except one, which was fixed.</details>",
                      )
                    : mode === "none-current-repeat-clock"
                      ? "\n" +
                        helpFooter.replace(
                          "</details>",
                          "Security issue: none currently exist.</details>",
                        )
                      : mode === "none-were-repeat-clock"
                        ? "\n" +
                          helpFooter.replace(
                            "</details>",
                            "Security issue: none were found.</details>",
                          )
                        : [
                              "may-reappear-repeat-clock",
                              "defect-repeat-clock",
                              "regression-repeat-clock",
                              "qualified-absence-repeat-clock",
                              "security-risk-repeat-clock",
                              "causes-repeat-clock",
                              "exposes-repeat-clock",
                              "qualified-fixed-repeat-clock",
                              "regression-tests-repeat-clock",
                              "not-remain-fixed-repeat-clock",
                              "exception-recurred-repeat-clock",
                              "regression-test-count-repeat-clock",
                              "defect-report-count-repeat-clock",
                              "must-fixed-repeat-clock",
                              "should-fixed-repeat-clock",
                              "fixed-one-repeat-clock",

                              "introduces-repeat-clock",
                              "creates-repeat-clock",
                              "contains-repeat-clock",
                              "has-finding-repeat-clock",

                              "reappeared-repeat-clock",
                              "perfect-reappeared-repeat-clock",
                              "recurred-repeat-clock",
                              "reopened-repeat-clock",
                              "qualified-harmless-repeat-clock",
                              "already-fixed-exception-repeat-clock",
                              "bare-critical-repeat-clock",
                              "bare-authentication-repeat-clock",
                              "most-count-repeat-clock",
                              "every-count-repeat-clock",
                              "numerous-count-repeat-clock",
                              "no-exist-repeat-clock",
                              "no-remain-repeat-clock",
                            ].includes(mode)
                          ? "\n" +
                            helpFooter.replace(
                              "</details>",
                              ({
                                "introduces-repeat-clock":
                                  "This change introduces a bug.",
                                "creates-repeat-clock":
                                  "This change creates a bug.",
                                "contains-repeat-clock":
                                  "This change contains a bug.",
                                "has-finding-repeat-clock":
                                  "This change has a bug.",
                                "causes-repeat-clock":
                                  "This change causes a regression.",
                                "exposes-repeat-clock":
                                  "This patch exposes a vulnerability.",
                                "security-risk-repeat-clock":
                                  "A security risk remains.",
                                "qualified-absence-repeat-clock":
                                  "The security issue does not exist locally but remains in production.",
                                "qualified-fixed-repeat-clock":
                                  "A security issue is already fixed in tests but exploitable in production.",
                                "regression-tests-repeat-clock":
                                  "Regression tests passed.",
                                "not-remain-fixed-repeat-clock":
                                  "The issue does not remain fixed.",
                                "exception-recurred-repeat-clock":
                                  "No issues were found except one already fixed that has reappeared.",
                                "regression-test-count-repeat-clock":
                                  "One regression test passed.",
                                "defect-report-count-repeat-clock":
                                  "One defect report was closed.",
                                "must-fixed-repeat-clock":
                                  "A bug must be fixed.",
                                "should-fixed-repeat-clock":
                                  "A bug should be fixed.",
                                "fixed-one-repeat-clock": "Fixed one issue.",
                                "direct-reappeared-repeat-clock":
                                  "An eliminated issue reappeared.",
                                "perfect-reappeared-repeat-clock":
                                  "An eliminated issue has reappeared.",
                                "recurred-repeat-clock":
                                  "A fixed bug recurred.",
                                "reopened-repeat-clock":
                                  "A resolved issue reopened.",
                                "qualified-harmless-repeat-clock":
                                  "The security issue is harmless in tests but exploitable in production.",
                                "already-fixed-exception-repeat-clock":
                                  "No issues were found except one already fixed.",
                                "bare-critical-repeat-clock":
                                  "Critical security issue remains.",
                                "bare-authentication-repeat-clock":
                                  "Authentication vulnerability exists.",
                                "most-count-repeat-clock":
                                  "Most issues remain.",
                                "every-count-repeat-clock":
                                  "Every issue remains.",
                                "numerous-count-repeat-clock":
                                  "Numerous issues remain.",
                                "no-exist-repeat-clock": "Issues do not exist.",
                                "no-remain-repeat-clock": "Bugs do not remain.",
                              }[mode] ??
                                (mode === "defect-repeat-clock"
                                  ? "A defect remains."
                                  : mode === "regression-repeat-clock"
                                    ? "A regression remains."
                                    : "An eliminated issue may reappear.")) +
                                "</details>",
                            )
                          : mode === "both-count-repeat-clock"
                            ? "\n" +
                              helpFooter.replace(
                                "</details>",
                                "Both issues remain.</details>",
                              )
                            : mode === "many-count-repeat-clock"
                              ? "\n" +
                                helpFooter.replace(
                                  "</details>",
                                  "Many issues remain.</details>",
                                )
                              : mode === "all-count-repeat-clock"
                                ? "\n" +
                                  helpFooter.replace(
                                    "</details>",
                                    "All issues remain unresolved.</details>",
                                  )
                                : mode === "still-bug-repeat-clock"
                                  ? "\n" +
                                    helpFooter.replace(
                                      "</details>",
                                      "The bug still exists.</details>",
                                    )
                                  : mode === "there-still-bug-repeat-clock"
                                    ? "\n" +
                                      helpFooter.replace(
                                        "</details>",
                                        "There still is a bug.</details>",
                                      )
                                    : mode === "have-one-repeat-clock"
                                      ? "\n" +
                                        helpFooter.replace(
                                          "</details>",
                                          "We have one security issue.</details>",
                                        )
                                      : mode ===
                                          "eliminated-documented-repeat-clock"
                                        ? "\n" +
                                          helpFooter.replace(
                                            "</details>",
                                            "An eliminated issue was documented.</details>",
                                          )
                                        : mode === "center-repeat-clock"
                                          ? "\n" +
                                            helpFooter.replace(
                                              "</details>",
                                              "No<center>An issue remains</center></details>",
                                            )
                                          : mode ===
                                              "exception-one-repeat-clock"
                                            ? "\n" +
                                              helpFooter.replace(
                                                "</details>",
                                                "No issues or findings were found—except one.</details>",
                                              )
                                            : mode === "reappeared-repeat-clock"
                                              ? "\n" +
                                                helpFooter.replace(
                                                  "</details>",
                                                  "An eliminated issue was found again.</details>",
                                                )
                                              : mode ===
                                                  "none-exist-repeat-clock"
                                                ? "\n" +
                                                  helpFooter.replace(
                                                    "</details>",
                                                    "Security issue: none exist.</details>",
                                                  )
                                                : mode ===
                                                    "nominal-this-repeat-clock"
                                                  ? "\n" +
                                                    helpFooter.replace(
                                                      "</details>",
                                                      "This is an issue.</details>",
                                                    )
                                                  : mode ===
                                                      "nominal-that-repeat-clock"
                                                    ? "\n" +
                                                      helpFooter.replace(
                                                        "</details>",
                                                        "That is a bug.</details>",
                                                      )
                                                    : mode ===
                                                        "raw-html-numeric-repeat-clock"
                                                      ? "\n<div>\nP&#49 blocker\n</div>"
                                                      : mode ===
                                                          "markdown-numeric-repeat-clock"
                                                        ? "\n<span>P&#49</span> blocker"
                                                        : mode ===
                                                            "code-numeric-repeat-clock"
                                                          ? "\n`P&#49` blocker"
                                                          : mode ===
                                                              "finding-softbreak-repeat-clock"
                                                            ? "\nFound\nan issue."
                                                            : mode ===
                                                                "finding-blankline-repeat-clock"
                                                              ? "\nFound\n\nan issue."
                                                              : mode ===
                                                                  "quoted-raw-html-repeat-clock"
                                                                ? "\n> <div>\n> [safe](P1)\n> </div>"
                                                                : mode ===
                                                                    "quoted-html-exit-repeat-clock"
                                                                  ? "\n> <div>\n[safe](P1)"
                                                                  : mode ===
                                                                      "list-html-exit-repeat-clock"
                                                                    ? "\n- <div>\n[safe](P1)"
                                                                    : mode ===
                                                                        "list-raw-html-repeat-clock"
                                                                      ? "\n- <div>\n  [safe](P1)\n  </div>"
                                                                      : mode ===
                                                                          "mixed-finding-count-repeat-clock"
                                                                        ? "\nFound 0 code issues and 1 security issue."
                                                                        : mode ===
                                                                            "existential-finding-repeat-clock"
                                                                          ? "\nThere is an issue."
                                                                          : mode ===
                                                                              "detected-finding-repeat-clock"
                                                                            ? "\nDetected 1 issue."
                                                                            : mode ===
                                                                                "detected-article-repeat-clock"
                                                                              ? "\nDetected an issue."
                                                                              : mode ===
                                                                                  "reverse-container-repeat-clock"
                                                                                ? "\n- > <div>\n  > [safe](P1)"
                                                                                : mode ===
                                                                                    "unresolved-count-repeat-clock"
                                                                                  ? "\n1 unresolved finding."
                                                                                  : mode ===
                                                                                      "used-footnote-repeat-clock"
                                                                                    ? "\nnote[^doc]\n\n[^doc]: P1"
                                                                                    : mode ===
                                                                                        "invalid-footnote-label-repeat-clock"
                                                                                      ? "\n[^bad label]: P1 blocker"
                                                                                      : mode ===
                                                                                          "invalid-footnote-reference-repeat-clock"
                                                                                        ? "\n[^bad label]: P1"
                                                                                        : mode ===
                                                                                            "footnote-two-space-repeat-clock"
                                                                                          ? "\n[^doc]: safe\n  P1"
                                                                                          : mode ===
                                                                                              "footnote-four-space-repeat-clock"
                                                                                            ? "\n[^doc]: safe\n    P1"
                                                                                            : mode ===
                                                                                                "used-footnote-four-space-repeat-clock"
                                                                                              ? "\nnote[^doc]\n\n[^doc]: safe\n    P1"
                                                                                              : mode ===
                                                                                                  "transitive-footnote-repeat-clock"
                                                                                                ? "\nroot[^a]\n\n[^a]: safe [^b]\n[^b]: P1"
                                                                                                : mode ===
                                                                                                    "footnote-destination-repeat-clock"
                                                                                                  ? "\n[safe](https://example.test/[^note])\n\n[^note]: P1 example"
                                                                                                  : mode ===
                                                                                                      "footnote-reference-destination-repeat-clock"
                                                                                                    ? "\n[safe]: https://example.test/[^note]\n\n[^note]: P1 example"
                                                                                                    : mode ===
                                                                                                        "footnote-reference-title-repeat-clock"
                                                                                                      ? '\n[safe]: /url\n  "title [^note]"\n[^note]: P1'
                                                                                                      : mode ===
                                                                                                          "unicode-footnote-repeat-clock"
                                                                                                        ? "\nnote[^SS]\n\n[^ß]: P1 blocker"
                                                                                                        : mode ===
                                                                                                            "bug-repeat-clock"
                                                                                                          ? "\nThere is a bug."
                                                                                                          : mode ===
                                                                                                              "not-fixed-repeat-clock"
                                                                                                            ? "\n1 bug is not fixed"
                                                                                                            : mode ===
                                                                                                                "not-resolved-repeat-clock"
                                                                                                              ? "\nThere is an issue that was not resolved"
                                                                                                              : mode ===
                                                                                                                  "unrelated-negation-repeat-clock"
                                                                                                                ? "\nThis is not safe because there is a bug."
                                                                                                                : mode ===
                                                                                                                    "grouped-count-repeat-clock"
                                                                                                                  ? "\nFound 1,000 issues."
                                                                                                                  : mode ===
                                                                                                                      "vulnerability-repeat-clock"
                                                                                                                    ? "\n" +
                                                                                                                      helpFooter.replace(
                                                                                                                        "</details>",
                                                                                                                        "A vulnerability was detected.</details>",
                                                                                                                      )
                                                                                                                    : mode ===
                                                                                                                        "coordinated-nouns-repeat-clock"
                                                                                                                      ? "\n" +
                                                                                                                        helpFooter.replace(
                                                                                                                          "</details>",
                                                                                                                          "No issues or findings were found.</details>",
                                                                                                                        )
                                                                                                                      : mode ===
                                                                                                                          "colon-security-repeat-clock"
                                                                                                                        ? "\n" +
                                                                                                                          helpFooter.replace(
                                                                                                                            "</details>",
                                                                                                                            "Security issue: authentication bypass.</details>",
                                                                                                                          )
                                                                                                                        : mode ===
                                                                                                                            "colon-passive-repeat-clock"
                                                                                                                          ? "\n" +
                                                                                                                            helpFooter.replace(
                                                                                                                              "</details>",
                                                                                                                              "A security issue: was flagged.</details>",
                                                                                                                            )
                                                                                                                          : mode ===
                                                                                                                              "eliminated-repeat-clock"
                                                                                                                            ? "\n" +
                                                                                                                              helpFooter.replace(
                                                                                                                                "</details>",
                                                                                                                                "A security issue got eliminated.</details>",
                                                                                                                              )
                                                                                                                            : mode ===
                                                                                                                                "contextual-unresolved-repeat-clock"
                                                                                                                              ? "\n" +
                                                                                                                                helpFooter.replace(
                                                                                                                                  "</details>",
                                                                                                                                  "This issue is not resolved.</details>",
                                                                                                                                )
                                                                                                                              : mode ===
                                                                                                                                  "plural-persist-repeat-clock"
                                                                                                                                ? "\n" +
                                                                                                                                  helpFooter.replace(
                                                                                                                                    "</details>",
                                                                                                                                    "Issues persist.</details>",
                                                                                                                                  )
                                                                                                                                : mode ===
                                                                                                                                    "plural-outstanding-repeat-clock"
                                                                                                                                  ? "\n" +
                                                                                                                                    helpFooter.replace(
                                                                                                                                      "</details>",
                                                                                                                                      "Findings are outstanding.</details>",
                                                                                                                                    )
                                                                                                                                  : mode ===
                                                                                                                                      "mixed-needed-repeat-clock"
                                                                                                                                    ? "\n" +
                                                                                                                                      helpFooter.replace(
                                                                                                                                        "</details>",
                                                                                                                                        "No code changes were needed and one security issue remains.</details>",
                                                                                                                                      )
                                                                                                                                    : mode ===
                                                                                                                                        "got-passive-repeat-clock"
                                                                                                                                      ? "\nA security issue got flagged."
                                                                                                                                      : mode ===
                                                                                                                                          "documented-meta-repeat-clock"
                                                                                                                                        ? "\nThe words security issues are documented below."
                                                                                                                                        : mode ===
                                                                                                                                            "positive-count-zero-colon-repeat-clock"
                                                                                                                                          ? "\n1 issue: zero"
                                                                                                                                          : mode ===
                                                                                                                                              "indefinite-present-repeat-clock"
                                                                                                                                            ? "\n" +
                                                                                                                                              helpFooter.replace(
                                                                                                                                                "</details>",
                                                                                                                                                "A bug is present.\n</details>",
                                                                                                                                              )
                                                                                                                                            : mode ===
                                                                                                                                                "indefinite-happens-repeat-clock"
                                                                                                                                              ? "\n" +
                                                                                                                                                helpFooter.replace(
                                                                                                                                                  "</details>",
                                                                                                                                                  "A bug happens.\n</details>",
                                                                                                                                                )
                                                                                                                                              : mode ===
                                                                                                                                                  "indefinite-exists-repeat-clock"
                                                                                                                                                ? "\n" +
                                                                                                                                                  helpFooter.replace(
                                                                                                                                                    "</details>",
                                                                                                                                                    "An issue exists.\n</details>",
                                                                                                                                                  )
                                                                                                                                                : mode ===
                                                                                                                                                    "ordinary-definition-repeat-clock"
                                                                                                                                                  ? "\n\n[safe]: P1"
                                                                                                                                                  : mode ===
                                                                                                                                                      "zero-after-colon-repeat-clock"
                                                                                                                                                    ? "\nFound issues: zero. Issues found: zero."
                                                                                                                                                    : mode ===
                                                                                                                                                        "colon-count-repeat-clock"
                                                                                                                                                      ? "\nNo code issues: 1 security issue found"
                                                                                                                                                      : mode ===
                                                                                                                                                          "emphasized-repeat-clock"
                                                                                                                                                        ? "\nThe word issues is emphasized."
                                                                                                                                                        : mode ===
                                                                                                                                                            "type7-indented-repeat-clock"
                                                                                                                                                          ? "\n\n    example\n<span>\n[safe](P1)\n</span>"
                                                                                                                                                          : mode ===
                                                                                                                                                              "wrapped-numeric-repeat-clock"
                                                                                                                                                            ? "\n<div>\nFound **1** issue\n</div>"
                                                                                                                                                            : mode ===
                                                                                                                                                                "passive-finding-repeat-clock"
                                                                                                                                                              ? "\nAn issue was detected."
                                                                                                                                                              : mode ===
                                                                                                                                                                  "bugfree-repeat-clock"
                                                                                                                                                                ? "\nThis is a bug-free change"
                                                                                                                                                                : mode ===
                                                                                                                                                                    "type7-paragraph-repeat-clock"
                                                                                                                                                                  ? "\nparagraph\n<span>\n[safe](P1)"
                                                                                                                                                                  : mode ===
                                                                                                                                                                      "unmatched-underscore-repeat-clock"
                                                                                                                                                                    ? "\nP_1 is not a priority token"
                                                                                                                                                                    : mode ===
                                                                                                                                                                        "unmatched-star-repeat-clock"
                                                                                                                                                                      ? "\nP*1"
                                                                                                                                                                      : mode ===
                                                                                                                                                                          "abrupt-comment-repeat-clock"
                                                                                                                                                                        ? "\n<!-->P1 blocker"
                                                                                                                                                                        : mode ===
                                                                                                                                                                            "abrupt-dash-comment-repeat-clock"
                                                                                                                                                                          ? "\n<!--->P1 blocker"
                                                                                                                                                                          : mode ===
                                                                                                                                                                              "tab-list-repeat-clock"
                                                                                                                                                                            ? "\n-  <div>\n \t[safe](P1)\n   </div>"
                                                                                                                                                                            : mode ===
                                                                                                                                                                                "footnote-transitive-reference-repeat-clock"
                                                                                                                                                                              ? "\nroot[^a]\n\n[^a]: safe\n  [safe]: https://example.test/[^note]\n[^note]: P1 example"
                                                                                                                                                                              : mode ===
                                                                                                                                                                                  "footnote-transitive-destination-repeat-clock"
                                                                                                                                                                                ? "\nroot[^a]\n\n[^a]: [safe](https://example.test/[^note])\n[^note]: P1 example"
                                                                                                                                                                                : mode ===
                                                                                                                                                                                    "unused-footnote-repeat-clock"
                                                                                                                                                                                  ? "\n[^doc]: P1"
                                                                                                                                                                                  : mode ===
                                                                                                                                                                                      "deep-destination-repeat-clock"
                                                                                                                                                                                    ? "\n[safe](" +
                                                                                                                                                                                      "(".repeat(
                                                                                                                                                                                        33,
                                                                                                                                                                                      ) +
                                                                                                                                                                                      "P1" +
                                                                                                                                                                                      ")".repeat(
                                                                                                                                                                                        33,
                                                                                                                                                                                      ) +
                                                                                                                                                                                      ")"
                                                                                                                                                                                    : mode ===
                                                                                                                                                                                        "allzero-finding-count-repeat-clock"
                                                                                                                                                                                      ? "\nFound 0 code issues and 0 security issues."
                                                                                                                                                                                      : mode ===
                                                                                                                                                                                          "raw-html-link-repeat-clock"
                                                                                                                                                                                        ? "\n<div>\n[safe](P1)\n</div>"
                                                                                                                                                                                        : mode ===
                                                                                                                                                                                            "found-html-no-repeat-clock"
                                                                                                                                                                                          ? "\nFound <em>no</em> issues"
                                                                                                                                                                                          : mode ===
                                                                                                                                                                                              "found-html-zero-repeat-clock"
                                                                                                                                                                                            ? "\nFound <code>0</code> issues"
                                                                                                                                                                                            : mode ===
                                                                                                                                                                                                "html-break-repeat-clock"
                                                                                                                                                                                              ? "\nDo<br>not<br>merge"
                                                                                                                                                                                              : mode ===
                                                                                                                                                                                                  "code-priority-repeat-clock"
                                                                                                                                                                                                ? "\nP`1`"
                                                                                                                                                                                                : mode ===
                                                                                                                                                                                                    "code-warning-repeat-clock"
                                                                                                                                                                                                  ? "\nDo `not` merge"
                                                                                                                                                                                                  : mode ===
                                                                                                                                                                                                      "blank-label-repeat-clock"
                                                                                                                                                                                                    ? "\n[safe\n\nlabel](P1)"
                                                                                                                                                                                                    : mode ===
                                                                                                                                                                                                        "found-word-count-repeat-clock"
                                                                                                                                                                                                      ? "\nFound one issue"
                                                                                                                                                                                                      : mode ===
                                                                                                                                                                                                          "found-html-article-repeat-clock"
                                                                                                                                                                                                        ? "\nFound <em>an</em> issue"
                                                                                                                                                                                                        : "\nFound an issue";
      old.updated_at = "2026-10-20T12:05:00Z";
      request.created_at = "2026-10-20T12:06:00Z";
      receipt.created_at = "2026-10-20T12:07:00Z";
    }
    if (mode === "balanced-link-clear")
      newer.body = newer.body.replaceAll(
        "Manual request",
        "Do [not](https://example.com/(x)) merge",
      );
    if (
      [
        "inactive-numeric-row-clock",
        "inactive-nbsp-row-clock",
        "inactive-html-row-clock",
        "inactive-optional-pipe-row-clock",
        "inactive-quoted-row-clock",
      ].includes(mode)
    ) {
      const codeBody = (negative, time) =>
        cleanStateBody(HEAD, (state) => ({
          ...state,
          code_review: {
            ...state.code_review,
            has_any_findings: negative,
            has_unresolved_findings: negative,
          },
        })).replaceAll("2026-10-20T12:02:00Z", time);
      const label =
        mode === "inactive-numeric-row-clock"
          ? "Security&#32;Review"
          : mode === "inactive-nbsp-row-clock"
            ? "Security&nbsp;Review"
            : mode === "inactive-html-row-clock"
              ? "Security<em> Review</em>"
              : mode === "inactive-quoted-row-clock"
                ? "Security&#32;Review"
                : "Security Review";
      old.body =
        codeBody(true, "2026-10-20T12:01:00Z") +
        `\n| 🔒 **${label}** | ✅ **Completed** <relative-time datetime="2026-10-20T12:01:00Z">2026-10-20T12:01:00Z</relative-time> | \`${HEAD.slice(0, 7)}\` | Manual request |`;
      if (mode === "inactive-optional-pipe-row-clock")
        old.body = old.body.replace("\n| 🔒", "\n🔒");
      if (mode === "inactive-quoted-row-clock")
        old.body = old.body.replace(
          /\n(\| 🔒[^\n]+)$/,
          "\n<details><summary>ℹ️ About Codex in GitHub</summary>\n> $1\n</details>",
        );
      old.updated_at = "2026-10-20T12:05:00Z";
      newer.body = codeBody(false, "2026-10-20T12:02:00Z");
      newer.created_at = "2026-10-20T12:02:00Z";
      request.created_at = "2026-10-20T12:06:00Z";
      receipt.created_at = "2026-10-20T12:07:00Z";
    }
    if (mode === "variation-priority-clear")
      newer.body = newer.body.replaceAll("Manual request", "P\uFE0F1 blocker");
    if (mode === "zerowidth-priority-clear")
      newer.body = newer.body.replaceAll("Manual request", "P&#8203;1 blocker");
    if (mode === "multiline-comment-clear")
      newer.body = newer.body.replace(
        'datetime="2026-10-20T12:05:00Z"',
        'datetime="2026-10-20T12:<!-- metadata\n-->05:00Z"',
      );
    if (mode === "markdown-trigger-clear")
      newer.body = newer.body.replaceAll("Manual request", "Do **not** merge");
    if (["duplicate-row-clock", "hidden-row-clock"].includes(mode)) {
      old.updated_at = "2026-10-20T12:05:00Z";
      request.created_at = "2026-10-20T12:06:00Z";
      receipt.created_at = "2026-10-20T12:07:00Z";
      newer.created_at = "2026-10-20T12:03:00Z";
      newer.body = securityHistoryBody(false, "2026-10-20T12:03:00Z");
      if (mode === "duplicate-row-clock")
        old.body +=
          "\n " + old.body.split("\n").find((line) => line.startsWith("| 🔒"));
      else old.body = old.body.replace(/^(\| 🔒[^\n]+)$/m, "<!--\n$1\n-->");
    }
    if (mode === "numeric-priority-clear")
      newer.body = newer.body.replaceAll("Manual request", "P&#49; blocker");
    if (mode === "markdown-priority-clear")
      newer.body = newer.body.replaceAll("Manual request", "P*1* blocker");
    if (mode === "numeric-trigger-clear")
      newer.body = newer.body.replaceAll(
        "Manual request",
        "Do&#32;not&#32;merge",
      );
    if (mode === "entity-trigger-clear")
      newer.body = newer.body.replaceAll("Manual request", "Do not&nbsp;merge");
    if (mode === "contradictory-trigger-clear")
      newer.body = newer.body.replaceAll("Manual request", "Do not merge");
    if (mode === "quoted-fence-clear")
      newer.body += "\n> ```html\n> <!-- codex-review-state:v1 {} -->\n> ```";
    if (mode === "fenced-example-clear")
      newer.body += "\n```html\n<!-- codex-review-state:v1 example -->\n```";
    if (mode === "example-clear")
      newer.body += "\n\t<!-- codex-pull-request-review-summary -->";
    if (mode === "uppercase-clear")
      newer.body += "\n<!-- CODEX-review-state:v1 {} -->";
    if (mode === "old-security-clock")
      newer.body = newer.body
        .split("\n")
        .map((line) =>
          line.includes("**Security Review**")
            ? line.replaceAll("2026-10-20T12:05:00Z", "2026-10-20T12:02:00Z")
            : line,
        )
        .join("\n");
    if (mode === "missing-security-clock")
      newer.body = newer.body.replace(
        /(Security Review\*\* \| ✅ \*\*Completed\*\*) <relative-time[^>]+>[^<]+<\/relative-time>/,
        "$1",
      );
    const events = [
      { ...activation, created_at: "2026-10-20T12:00:00Z" },
      old,
      request,
      ...(mode === "formal" ? [] : [receipt]),
      ...([
        "security-null",
        "example-clear",
        "fenced-example-clear",
        "quoted-fence-clear",
        "contradictory-trigger-clear",
        "embedded-bom-clear",
        "comment-heading-clear",
        "mediumspace-clear",
        "hairspace-clear",
        "multiline-comment-clear",
        "zerowidth-priority-clear",
        "variation-priority-clear",
        "balanced-link-clear",
        "malformed-link-clear",
        "title-double-clear",
        "title-single-clear",
        "title-paren-clear",
        "escaped-space-clear",
        "space-destination-clear",
        "empty-destination-clear",
        "escaped-opener-clear",
        "escaped-label-closer-clear",
        "nested-link-clear",
        "found-article-repeat-clock",
        "found-html-article-repeat-clock",
        "found-word-count-repeat-clock",
        "blank-label-repeat-clock",
        "html-break-repeat-clock",
        "code-priority-repeat-clock",
        "code-warning-repeat-clock",
        "raw-html-link-repeat-clock",
        "quoted-raw-html-repeat-clock",
        "quoted-html-exit-repeat-clock",
        "list-html-exit-repeat-clock",
        "list-raw-html-repeat-clock",
        "mixed-finding-count-repeat-clock",
        "existential-finding-repeat-clock",
        "detected-finding-repeat-clock",
        "detected-article-repeat-clock",
        "reverse-container-repeat-clock",
        "unresolved-count-repeat-clock",
        "used-footnote-repeat-clock",
        "invalid-footnote-label-repeat-clock",
        "invalid-footnote-reference-repeat-clock",
        "footnote-two-space-repeat-clock",
        "footnote-four-space-repeat-clock",
        "used-footnote-four-space-repeat-clock",
        "transitive-footnote-repeat-clock",
        "footnote-destination-repeat-clock",
        "footnote-reference-destination-repeat-clock",
        "footnote-reference-title-repeat-clock",
        "bugfree-repeat-clock",
        "type7-paragraph-repeat-clock",
        "unmatched-underscore-repeat-clock",
        "unmatched-star-repeat-clock",

        "unicode-footnote-repeat-clock",
        "bug-repeat-clock",
        "not-fixed-repeat-clock",
        "not-resolved-repeat-clock",
        "unrelated-negation-repeat-clock",
        "flaw-repeat-clock",
        "worded-count-repeat-clock",
        "br-finding-repeat-clock",
        "harmless-repeat-clock",
        "benign-repeat-clock",
        "except-fixed-repeat-clock",
        "none-current-repeat-clock",
        "none-were-repeat-clock",
        "may-reappear-repeat-clock",
        "defect-repeat-clock",
        "regression-repeat-clock",
        "qualified-absence-repeat-clock",
        "security-risk-repeat-clock",
        "causes-repeat-clock",
        "exposes-repeat-clock",
        "qualified-fixed-repeat-clock",
        "regression-tests-repeat-clock",
        "not-remain-fixed-repeat-clock",
        "exception-recurred-repeat-clock",
        "regression-test-count-repeat-clock",
        "defect-report-count-repeat-clock",
        "must-fixed-repeat-clock",
        "should-fixed-repeat-clock",
        "fixed-one-repeat-clock",

        "introduces-repeat-clock",
        "creates-repeat-clock",
        "contains-repeat-clock",
        "has-finding-repeat-clock",

        "direct-reappeared-repeat-clock",
        "perfect-reappeared-repeat-clock",
        "recurred-repeat-clock",
        "reopened-repeat-clock",
        "qualified-harmless-repeat-clock",
        "already-fixed-exception-repeat-clock",
        "bare-critical-repeat-clock",
        "bare-authentication-repeat-clock",
        "most-count-repeat-clock",
        "every-count-repeat-clock",
        "numerous-count-repeat-clock",
        "no-exist-repeat-clock",
        "no-remain-repeat-clock",

        "both-count-repeat-clock",
        "many-count-repeat-clock",
        "all-count-repeat-clock",
        "still-bug-repeat-clock",
        "there-still-bug-repeat-clock",
        "have-one-repeat-clock",
        "eliminated-documented-repeat-clock",
        "center-repeat-clock",
        "exception-one-repeat-clock",
        "reappeared-repeat-clock",
        "none-exist-repeat-clock",
        "nominal-this-repeat-clock",
        "nominal-that-repeat-clock",
        "grouped-count-repeat-clock",
        "vulnerability-repeat-clock",
        "coordinated-nouns-repeat-clock",
        "colon-security-repeat-clock",
        "colon-passive-repeat-clock",
        "eliminated-repeat-clock",
        "contextual-unresolved-repeat-clock",
        "plural-persist-repeat-clock",
        "plural-outstanding-repeat-clock",
        "mixed-needed-repeat-clock",
        "got-passive-repeat-clock",
        "documented-meta-repeat-clock",
        "positive-count-zero-colon-repeat-clock",
        "indefinite-present-repeat-clock",
        "indefinite-happens-repeat-clock",
        "indefinite-exists-repeat-clock",
        "ordinary-definition-repeat-clock",
        "zero-after-colon-repeat-clock",
        "colon-count-repeat-clock",
        "emphasized-repeat-clock",
        "type7-indented-repeat-clock",

        "wrapped-numeric-repeat-clock",
        "passive-finding-repeat-clock",
        "abrupt-comment-repeat-clock",
        "abrupt-dash-comment-repeat-clock",
        "tab-list-repeat-clock",
        "footnote-transitive-reference-repeat-clock",
        "footnote-transitive-destination-repeat-clock",
        "unused-footnote-repeat-clock",
        "deep-destination-repeat-clock",
        "allzero-finding-count-repeat-clock",
        "finding-softbreak-repeat-clock",
        "raw-html-numeric-repeat-clock",
        "markdown-numeric-repeat-clock",
        "code-numeric-repeat-clock",
        "finding-blankline-repeat-clock",
        "found-html-no-repeat-clock",
        "found-html-zero-repeat-clock",
        "comment-pipe-clear",
        "inactive-numeric-row-clock",
        "inactive-nbsp-row-clock",
        "inactive-html-row-clock",
        "inactive-optional-pipe-row-clock",
        "inactive-quoted-row-clock",
        "marker-bom-clear",
        "marker-nbsp-clear",
        "zerowidth-trigger-clear",
        "namedzero-trigger-clear",
        "code-heading-space-clear",
        "code-heading-tab-clear",
        "markdown-trigger-clear",
        "entity-trigger-clear",
        "numeric-priority-clear",
        "duplicate-row-clock",
        "hidden-row-clock",
        "markdown-priority-clear",
        "numeric-trigger-clear",
        "trailing-marker-clear",
        "bom-space-clear",
        "bom-tab-clear",
        "warning-clear",
        "running-visible-clear",
        "newer-clear",
        "ordinary-comment-clear",
        "indented-comment-clear",
        "tabbed-comment-clear",
        "uppercase-clear",
        "equal-clear",
        "old-security-clock",
        "missing-security-clock",
      ].includes(mode)
        ? [newer]
        : []),
    ];
    const reviews =
      mode === "formal"
        ? [
            {
              id: 934,
              node_id: "history-review",
              commit_id: HEAD,
              body: "Codex Review",
              state: "APPROVED",
              user: { login: "chatgpt-codex-connector[bot]" },
              submitted_at: "2026-10-20T12:04:00Z",
            },
          ]
        : [];
    const result = runGate({
      comments: events,
      reviews,
      reviewUpdatedAt: "2026-10-20T12:04:00Z",
    });
    assert.equal(
      result.status === 0,
      [
        "none-exist-repeat-clock",
        "harmless-repeat-clock",
        "regression-tests-repeat-clock",
        "regression-test-count-repeat-clock",
        "defect-report-count-repeat-clock",
        "fixed-one-repeat-clock",

        "already-fixed-exception-repeat-clock",
        "no-exist-repeat-clock",
        "no-remain-repeat-clock",
        "benign-repeat-clock",
        "except-fixed-repeat-clock",
        "none-current-repeat-clock",
        "none-were-repeat-clock",
        "eliminated-documented-repeat-clock",
        "newer-clear",
        "coordinated-nouns-repeat-clock",
        "eliminated-repeat-clock",
        "documented-meta-repeat-clock",
        "ordinary-definition-repeat-clock",
        "zero-after-colon-repeat-clock",
        "emphasized-repeat-clock",
        "allzero-finding-count-repeat-clock",
        "footnote-destination-repeat-clock",
        "footnote-reference-destination-repeat-clock",
        "footnote-reference-title-repeat-clock",
        "bugfree-repeat-clock",
        "type7-paragraph-repeat-clock",
        "unmatched-underscore-repeat-clock",
        "unmatched-star-repeat-clock",

        "footnote-transitive-reference-repeat-clock",
        "footnote-transitive-destination-repeat-clock",
        "invalid-footnote-reference-repeat-clock",
        "footnote-two-space-repeat-clock",
        "footnote-four-space-repeat-clock",

        "quoted-html-exit-repeat-clock",
        "list-html-exit-repeat-clock",
        "unused-footnote-repeat-clock",
        "markdown-numeric-repeat-clock",
        "code-numeric-repeat-clock",
        "finding-blankline-repeat-clock",
        "found-html-no-repeat-clock",
        "found-html-zero-repeat-clock",
        "ordinary-comment-clear",
        "malformed-old",
        "duplicate-leading-old",
        "whole-fenced-old",
        "whole-quoted-old",
        "wrong-actor",
        "indented-old",
        "tabbed-old",
      ].includes(mode),
      result.stderr || result.stdout,
    );
  });
}

for (const section of ["code_review", "security_review"])
  test(`actual gate uses ${section} completion despite later shared edit`, () => {
    const old = comment(
      securityHistoryBody(false, "2026-10-20T12:01:00Z").replace(
        `"${section}":{"commit_sha":"${HEAD}","has_any_findings":false,"has_unresolved_findings":false`,
        `"${section}":{"commit_sha":"${HEAD}","has_any_findings":true,"has_unresolved_findings":true`,
      ),
      {
        id: 940,
        created_at: "2026-10-20T12:01:00Z",
        updated_at: "2026-10-20T12:05:00Z",
      },
    );
    const request = {
      ...comment(`@codex review ${HEAD}`, {
        id: 941,
        created_at: "2026-10-20T12:02:00Z",
      }),
      event: "commented",
      user: { login: "kiaquila" },
      author_association: "OWNER",
    };
    const clean = comment(securityHistoryBody(false, "2026-10-20T12:04:00Z"), {
      id: 942,
      created_at: "2026-10-20T12:04:00Z",
    });
    const events = [
      { event: "committed", sha: HEAD, created_at: "2026-10-20T12:00:00Z" },
      old,
      request,
      clean,
    ];
    const result = runGate({ timeline: events, comments: events });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

test("actual gate preserves concurrent running section observed clock", () => {
  const clean = comment(securityHistoryBody(false, "2026-10-20T12:04:00Z"), {
    id: 950,
    created_at: "2026-10-20T12:04:00Z",
  });
  let pendingBody = securityHistoryBody(true, "2026-10-20T12:01:00Z").replace(
    /"security_review":\{[^}]+\}/,
    `"security_review":{"commit_sha":"${HEAD}","has_any_findings":null,"has_unresolved_findings":null,"status":"running"}`,
  );
  pendingBody = pendingBody
    .split("\n")
    .map((line) =>
      line.includes("**Security Review**")
        ? line
            .replace("✅ **Completed**", "🔄 **Running** since")
            .replaceAll("2026-10-20T12:01:00Z", "2026-10-20T12:05:00Z")
        : line,
    )
    .join("\n");
  const pending = comment(pendingBody, {
    id: 951,
    created_at: "2026-10-20T12:01:00Z",
    updated_at: "2026-10-20T12:05:00Z",
  });
  const events = [
    { event: "committed", sha: HEAD, created_at: "2026-10-20T12:00:00Z" },
    clean,
    pending,
  ];
  const result = runGate({ timeline: events, comments: events });
  assert.notEqual(result.status, 0, result.stdout);
});

for (const clear of [false, true, "inactive-code", "edited-mixed"])
  test(`actual gate section head history ignores foreign other head: ${clear}`, () => {
    const foreign = "b".repeat(40);
    const mixed = (negative, time) =>
      securityHistoryBody(negative, time)
        .replace(
          `"code_review":{"commit_sha":"${HEAD}"`,
          `"code_review":{"commit_sha":"${foreign}"`,
        )
        .split("\n")
        .map((line) =>
          line.includes("**Code Review**")
            ? line.replace(HEAD.slice(0, 7), foreign.slice(0, 7))
            : line,
        )
        .join("\n");
    const old = comment(
      clear
        ? securityHistoryBody(true, "2026-10-20T12:01:00Z")
        : mixed(true, "2026-10-20T12:01:00Z"),
      { id: 960, created_at: "2026-10-20T12:01:00Z" },
    );
    if (clear === "edited-mixed") {
      old.body = mixed(true, "2026-10-20T12:01:00Z");
      old.updated_at = "2026-10-20T12:05:00Z";
    }
    const cleared = comment(mixed(false, "2026-10-20T12:02:00Z"), {
      id: 961,
      created_at: "2026-10-20T12:02:00Z",
    });
    if (clear === "inactive-code")
      cleared.body = cleared.body
        .replace(
          /"code_review":\{[^}]+\}/,
          '"code_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}',
        )
        .split("\n")
        .filter((line) => !line.includes("**Code Review**"))
        .join("\n");
    const request = {
      ...comment(`@codex review ${HEAD}`, {
        id: 962,
        created_at: "2026-10-20T12:03:00Z",
      }),
      event: "commented",
      user: { login: "kiaquila" },
      author_association: "OWNER",
    };
    const receipt = comment(presentationReceipt(HEAD, ":rocket:"), {
      id: 963,
      created_at: "2026-10-20T12:04:00Z",
    });
    const events = [
      { event: "committed", sha: HEAD, created_at: "2026-10-20T12:00:00Z" },
      old,
      ...(clear ? [cleared] : []),
      request,
      receipt,
    ];
    const result = runGate({ timeline: events, comments: events });
    assert.equal(
      result.status === 0,
      Boolean(clear),
      result.stderr || result.stdout,
    );
  });

test("actual gate preserves latest foreign negative observation", () => {
  const foreign = "b".repeat(40);
  const stale = comment(
    securityHistoryBody(true, "2026-10-20T12:01:00Z")
      .replaceAll(HEAD, foreign)
      .replaceAll(HEAD.slice(0, 7), foreign.slice(0, 7)),
    {
      id: 970,
      created_at: "2026-10-20T12:01:00Z",
      updated_at: "2026-10-20T12:05:00Z",
    },
  );
  const clean = comment(securityHistoryBody(false, "2026-10-20T12:04:00Z"), {
    id: 971,
    created_at: "2026-10-20T12:04:00Z",
  });
  const events = [
    { event: "committed", sha: HEAD, created_at: "2026-10-20T12:00:00Z" },
    clean,
    stale,
  ];
  const result = runGate({ timeline: events, comments: events });
  assert.notEqual(result.status, 0, result.stdout);
});

test("actual gate scopes edited warning clocks to their canonical section", () => {
  const body = (code, security, time) =>
    cleanStateBody(HEAD, (state) => ({
      ...state,
      code_review: {
        ...state.code_review,
        has_any_findings: code,
        has_unresolved_findings: code,
      },
      security_review: {
        ...state.code_review,
        has_any_findings: security,
        has_unresolved_findings: security,
      },
    })).replaceAll("2026-10-20T12:02:00Z", time) +
    `\n| 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="${time}">${time}</relative-time> | \`${HEAD.slice(0, 7)}\` | Manual request |`;
  const old = comment(
    body(true, true, "2026-10-20T12:01:00Z").replace(
      /^(\| 🔒[^\n]+)Manual request/gm,
      "$1 P1",
    ),
    {
      id: 940,
      created_at: "2026-10-20T12:01:00Z",
      updated_at: "2026-10-20T12:05:00Z",
    },
  );
  const codeclear = comment(body(false, true, "2026-10-20T12:02:00Z"), {
    id: 942,
    created_at: "2026-10-20T12:02:00Z",
  });
  const securityBody = body(false, false, "2026-10-20T12:06:00Z")
    .replace(
      /"code_review":\{[^}]+\}/,
      '"code_review":{"status":null,"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null}',
    )
    .replace(/^\| 📝[^\n]+\n/gm, "");
  const securityclear = comment(securityBody, {
    id: 944,
    created_at: "2026-10-20T12:06:00Z",
  });
  const request = {
    ...comment(`@codex review ${HEAD}`, {
      id: 941,
      created_at: "2026-10-20T12:07:00Z",
    }),
    event: "commented",
    user: { login: "kiaquila" },
    author_association: "OWNER",
  };
  const events = [
    { ...activation, created_at: "2026-10-20T12:00:00Z" },
    old,
    codeclear,
    securityclear,
    request,
    comment(presentationReceipt(HEAD, ":rocket:"), {
      id: 943,
      created_at: "2026-10-20T12:08:00Z",
    }),
  ];
  assert.equal(runGate({ timeline: events, comments: events }).status, 0);
  const uncleared = events.filter((event) => event.id !== 944);
  assert.notEqual(
    runGate({ timeline: uncleared, comments: uncleared }).status,
    0,
  );
});

test("actual gate retains contradictory false companion trigger observation", () => {
  const body = (code, security, time) =>
    cleanStateBody(HEAD, (state) => ({
      ...state,
      code_review: {
        ...state.code_review,
        has_any_findings: code,
        has_unresolved_findings: code,
      },
      security_review: {
        ...state.code_review,
        has_any_findings: security,
        has_unresolved_findings: security,
      },
    })).replaceAll("2026-10-20T12:02:00Z", time) +
    `\n| 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="${time}">${time}</relative-time> | \`${HEAD.slice(0, 7)}\` | Manual request |`;
  const old = comment(
    body(true, false, "2026-10-20T12:01:00Z").replace(
      /^(\| 🔒[^\n]+)Manual request/gm,
      "$1 P1",
    ),
    {
      id: 940,
      created_at: "2026-10-20T12:01:00Z",
      updated_at: "2026-10-20T12:05:00Z",
    },
  );
  const codeclear = comment(body(false, true, "2026-10-20T12:02:00Z"), {
    id: 942,
    created_at: "2026-10-20T12:02:00Z",
  });
  const securityBody = body(false, false, "2026-10-20T12:06:00Z")
    .replace(
      /"code_review":\{[^}]+\}/,
      '"code_review":{"status":null,"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null}',
    )
    .replace(/^\| 📝[^\n]+\n/gm, "");
  const securityclear = comment(securityBody, {
    id: 944,
    created_at: "2026-10-20T12:06:00Z",
  });
  const request = {
    ...comment(`@codex review ${HEAD}`, {
      id: 941,
      created_at: "2026-10-20T12:07:00Z",
    }),
    event: "commented",
    user: { login: "kiaquila" },
    author_association: "OWNER",
  };
  const events = [
    { ...activation, created_at: "2026-10-20T12:00:00Z" },
    old,
    codeclear,
    request,
    comment(presentationReceipt(HEAD, ":rocket:"), {
      id: 943,
      created_at: "2026-10-20T12:08:00Z",
    }),
  ];
  assert.notEqual(runGate({ timeline: events, comments: events }).status, 0);
  const uncleared = events.filter((event) => event.id !== 944);
  assert.notEqual(
    runGate({ timeline: uncleared, comments: uncleared }).status,
    0,
  );
});

for (const recover of [false, true]) {
  test(`actual gate bounds completion by comment creation; recovery=${recover}`, () => {
    const h = HEAD;
    const body = (negative, time) =>
      cleanStateBody(h, (state) => ({
        ...state,
        security_review: {
          ...state.code_review,
          has_any_findings: negative,
          has_unresolved_findings: negative,
        },
      })).replaceAll("2026-10-20T12:02:00Z", time) +
      `\n| 🔒 **Security Review** | ✅ **Completed** <relative-time datetime="${time}">${time}</relative-time> | \`${h.slice(0, 7)}\` | Manual request |`;
    const old = comment(body(true, "2026-10-20T12:01:00Z"), {
      id: 9550,
      created_at: "2026-10-20T12:03:00Z",
      updated_at: "2026-10-20T12:05:00Z",
    });
    const clear = comment(
      body(false, recover ? "2026-10-20T12:06:00Z" : "2026-10-20T12:02:00Z"),
      {
        id: 9551,
        created_at: recover ? "2026-10-20T12:06:00Z" : "2026-10-20T12:02:00Z",
      },
    );
    const request = {
      ...comment(`@codex review ${h}`, {
        id: 9552,
        created_at: "2026-10-20T12:07:00Z",
      }),
      event: "commented",
      user: { login: "kiaquila" },
      author_association: "OWNER",
    };
    const events = [
      { ...activation, created_at: "2026-10-20T12:00:00Z" },
      old,
      clear,
      request,
      comment(presentationReceipt(h, ":rocket:"), {
        id: 9553,
        created_at: "2026-10-20T12:08:00Z",
      }),
    ];
    const result = runGate({ comments: events, timeline: events });
    assert.equal(result.status === 0, recover, result.stderr || result.stdout);
  });
}
