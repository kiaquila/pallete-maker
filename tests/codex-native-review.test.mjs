import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  classifyCodexSummaryComment,
  matchesCodexSummaryComment,
  pickAuthoritativeCodexSkipModeComment,
} from "../scripts/ai-review-helpers.mjs";

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
test("a structured summary never grants a passing verdict", () => {
  const body =
    '<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {"code_review":{"commit_sha":"' +
    HEAD +
    '","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"}} -->\n## Codex Review Summary\nCompleted 👍';
  assert.equal(matchesCodexSummaryComment(comment(body)), false);
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
test("an edited receipt can be bound after a newer trigger, but an old legacy comment cannot", () => {
  const edited = comment(receipt, {
    created_at: "2026-10-14T10:00:00Z",
    updated_at: "2026-10-15T10:02:00Z",
  });
  assert.equal(
    pickAuthoritativeCodexSkipModeComment({
      headSha: HEAD,
      timelineEvents: [edited, activation, trigger],
    }).classification.outcome,
    "pass",
  );
  assert.equal(
    pickAuthoritativeCodexSkipModeComment({
      headSha: HEAD,
      timelineEvents: [{ ...edited, body: legacy }, activation, trigger],
    }),
    null,
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
          AI_REVIEW_WAIT_MS: "60",
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
