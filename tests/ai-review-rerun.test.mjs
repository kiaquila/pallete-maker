import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createAiReviewRequestMarkerBody,
  extractAiReviewRequestMarker,
  isTrustedAssociation,
  isTrustedReviewLogin,
  latestAiReviewRequestMarker,
  trustedReviewLoginsForAgent,
} from "../scripts/ai-review-helpers.mjs";
import {
  evidenceTimestamp,
  rerunAiReviewForPrHead,
  selectAiReviewRun,
  shouldRouteAiReviewRerunEvent,
} from "../scripts/ai-review-rerun.mjs";

const HEAD_SHA = "1234567890abcdef1234567890abcdef12345678";

describe("AI review request markers", () => {
  test("round-trips marker fields and binds them to github-actions[bot]", () => {
    const body = createAiReviewRequestMarkerBody({
      agent: "Codex",
      headSha: HEAD_SHA,
      requestId: "42-1234567890ab",
      sourceCommentId: "42",
      sourceCommentCreatedAt: "2026-05-12T10:00:00Z",
      requestedAt: "2026-05-12T10:00:01Z",
    });

    assert.deepEqual(extractAiReviewRequestMarker(body), {
      requestId: "42-1234567890ab",
      agent: "codex",
      sha: HEAD_SHA,
      sourceCommentId: "42",
      sourceCommentCreatedAt: "2026-05-12T10:00:00Z",
      requestedAt: "2026-05-12T10:00:01Z",
    });

    const latest = latestAiReviewRequestMarker(
      [
        {
          id: 1,
          body,
          created_at: "2026-05-12T10:00:02Z",
          user: { login: "github-actions[bot]" },
        },
      ],
      "codex",
      HEAD_SHA,
    );

    assert.equal(latest?.requestId, "42-1234567890ab");
  });

  test("ignores malformed markers and non-actions authors", () => {
    assert.equal(extractAiReviewRequestMarker("AI_REVIEW_SHA: nope"), null);
    assert.equal(
      latestAiReviewRequestMarker(
        [
          {
            id: 1,
            body: createAiReviewRequestMarkerBody({
              agent: "codex",
              headSha: HEAD_SHA,
              requestId: "1",
              sourceCommentId: "1",
              requestedAt: "2026-05-12T10:00:01Z",
            }),
            created_at: "2026-05-12T10:00:02Z",
            user: { login: "kiaquila" },
          },
        ],
        "codex",
        HEAD_SHA,
      ),
      null,
    );
  });
});

describe("trusted AI review rerun routing", () => {
  test("accepts trusted review bots for the selected native backend", () => {
    assert.equal(isTrustedAssociation("OWNER"), true);
    assert.equal(isTrustedAssociation("CONTRIBUTOR"), false);
    assert.equal(
      shouldRouteAiReviewRerunEvent(
        {
          review: {
            user: { login: "chatgpt-codex-connector[bot]" },
          },
        },
        "codex",
      ),
      true,
    );
    assert.equal(
      shouldRouteAiReviewRerunEvent(
        {
          review: {
            user: { login: "gemini-code-assist[bot]" },
          },
        },
        "codex",
      ),
      false,
    );
  });

  test("only accepts bot-suffixed logins from user config when expanding the trusted set", () => {
    const config = {
      trustedReviewLogins: ["kiaquila", "rogue-account[bot]"],
      trustedReviewLoginsByAgent: { codex: ["another-human"] },
    };

    const logins = trustedReviewLoginsForAgent("codex", config);
    assert.equal(logins.has("chatgpt-codex-connector[bot]"), true);
    assert.equal(logins.has("rogue-account[bot]"), true);
    assert.equal(logins.has("kiaquila"), false);
    assert.equal(logins.has("another-human"), false);

    assert.equal(isTrustedReviewLogin("kiaquila", "codex", config), false);
    assert.equal(
      isTrustedReviewLogin("rogue-account[bot]", "codex", config),
      true,
    );
  });

  test("routes Codex summary and Claude outcome comments, but rejects untrusted bot comments", () => {
    assert.equal(
      shouldRouteAiReviewRerunEvent(
        {
          issue: { pull_request: {} },
          comment: {
            body: "Codex Review: Didn't find any major issues.",
            user: { login: "chatgpt-codex-connector[bot]" },
          },
        },
        "codex",
      ),
      true,
    );
    assert.equal(
      shouldRouteAiReviewRerunEvent(
        {
          issue: { pull_request: {} },
          comment: {
            body: "AI_REVIEW_OUTCOME: pass",
            user: { login: "claude[bot]" },
          },
        },
        "claude",
      ),
      true,
    );
    assert.equal(
      shouldRouteAiReviewRerunEvent(
        {
          issue: { pull_request: {} },
          comment: {
            body: "Codex Review: Didn't find any major issues.",
            user: { login: "random-bot[bot]" },
          },
        },
        "codex",
      ),
      false,
    );
  });
});

describe("AI Review run selection", () => {
  test("prefers active runs, then rerunnable failures, then success", () => {
    const runs = [
      {
        id: 1,
        event: "pull_request",
        head_sha: HEAD_SHA,
        status: "completed",
        conclusion: "failure",
        created_at: "2026-05-12T10:00:00Z",
      },
      {
        id: 2,
        event: "pull_request",
        head_sha: HEAD_SHA,
        status: "in_progress",
        conclusion: null,
        created_at: "2026-05-12T10:01:00Z",
      },
    ];

    assert.equal(selectAiReviewRun(runs, HEAD_SHA).action, "already_running");
    assert.equal(selectAiReviewRun(runs.slice(0, 1), HEAD_SHA).action, "rerun");
    assert.equal(
      selectAiReviewRun(
        [
          {
            id: 3,
            event: "pull_request",
            head_sha: HEAD_SHA,
            status: "completed",
            conclusion: "success",
            created_at: "2026-05-12T10:02:00Z",
          },
        ],
        HEAD_SHA,
      ).action,
      "already_success",
    );
  });

  test("does not rerun an older failure after a newer success", () => {
    const decision = selectAiReviewRun(
      [
        {
          id: 1,
          event: "pull_request",
          head_sha: HEAD_SHA,
          status: "completed",
          conclusion: "failure",
          created_at: "2026-05-12T10:00:00Z",
        },
        {
          id: 2,
          event: "pull_request",
          head_sha: HEAD_SHA,
          status: "completed",
          conclusion: "success",
          created_at: "2026-05-12T10:01:00Z",
        },
      ],
      HEAD_SHA,
    );

    assert.equal(decision.action, "already_success");
    assert.equal(decision.run.id, 2);
  });

  test("reruns a successful run when newer review evidence arrives", () => {
    const decision = selectAiReviewRun(
      [
        {
          id: 1,
          event: "pull_request",
          head_sha: HEAD_SHA,
          status: "completed",
          conclusion: "success",
          created_at: "2026-05-12T10:00:00Z",
        },
      ],
      HEAD_SHA,
      "2026-05-12T10:01:00Z",
    );

    assert.equal(decision.action, "rerun");
    assert.equal(decision.run.id, 1);
  });

  test("treats `updated_at` as the latest run activity to suppress post-rerun edit storms", () => {
    const decision = selectAiReviewRun(
      [
        {
          id: 1,
          event: "pull_request",
          head_sha: HEAD_SHA,
          status: "completed",
          conclusion: "success",
          created_at: "2026-05-12T09:00:00Z",
          run_started_at: "2026-05-12T10:30:00Z",
          updated_at: "2026-05-12T10:30:30Z",
        },
      ],
      HEAD_SHA,
      "2026-05-12T10:00:00Z",
    );

    assert.equal(decision.action, "already_success");
    assert.equal(decision.run.id, 1);
  });

  test("ignores comment edits when picking evidence timestamps", () => {
    assert.equal(
      evidenceTimestamp({
        comment: {
          created_at: "2026-05-12T10:00:00Z",
          updated_at: "2026-05-12T11:30:00Z",
        },
      }),
      "2026-05-12T10:00:00Z",
    );

    assert.equal(
      evidenceTimestamp({
        review: { submitted_at: "2026-05-12T10:05:00Z" },
      }),
      "2026-05-12T10:05:00Z",
    );

    assert.equal(evidenceTimestamp({}), "");
  });

  test("requests a rerun for the selected failed pull_request run", async () => {
    const calls = [];
    const request = async (_token, _repository, path, options = {}) => {
      calls.push({ path, method: options.method || "GET" });
      if (path.includes("/actions/workflows/ai-review.yml/runs")) {
        return {
          workflow_runs: [
            {
              id: 99,
              event: "pull_request",
              head_sha: HEAD_SHA,
              status: "completed",
              conclusion: "timed_out",
              created_at: "2026-05-12T10:00:00Z",
            },
          ],
        };
      }
      return null;
    };

    const result = await rerunAiReviewForPrHead({
      token: "token",
      repository: "kiaquila/pallete-maker",
      headSha: HEAD_SHA,
      evidenceCreatedAt: "2026-05-12T10:01:00Z",
      request,
    });

    assert.equal(result.action, "rerun");
    assert.deepEqual(calls.at(-1), {
      path: "/repos/kiaquila/pallete-maker/actions/runs/99/rerun",
      method: "POST",
    });
  });
});
