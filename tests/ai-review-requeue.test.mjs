import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  routeAiReviewRerun,
  selectAiReviewRun,
  shouldRouteAiReviewRerunEvent,
} from "../scripts/ai-review-rerun.mjs";

const HEAD = "a".repeat(40);
const BOT = { login: "chatgpt-codex-connector[bot]", type: "Bot" };
const receipt = `<!-- codex-review-receipt:v1 -->\n\nCodex Review: Didn't find any major issues. :rocket:\n\n**Reviewed commit:** \`${HEAD.slice(0, 10)}\``;
const summary =
  '<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {"code_review":{"status":"completed"}} -->\n## Codex Review Summary';
const commentEvent = (body = receipt, action = "created", extra = {}) => ({
  action,
  issue: { number: 7, pull_request: {} },
  comment: { body, user: BOT, created_at: "2026-10-15T10:02:00Z", ...extra },
});
const completed = {
  action: "completed",
  workflow_run: {
    id: 99,
    path: ".github/workflows/ai-review.yml",
    name: "AI Review",
    event: "pull_request",
    head_sha: HEAD,
    pull_requests: [{ number: 7 }],
  },
};
const baseRun = {
  id: 99,
  event: "pull_request",
  head_sha: HEAD,
  status: "completed",
  conclusion: "failure",
  created_at: "2026-10-15T10:00:00Z",
  run_started_at: "2026-10-15T10:00:00Z",
  updated_at: "2026-10-15T10:03:00Z",
};
const workflow = readFileSync(
  new URL("../.github/workflows/ai-review-rerun.yml", import.meta.url),
  "utf8",
);
const filter = workflow.match(/    if: \|\n([\s\S]*?)    runs-on:/)[1];
// Evaluate the actual checked-in Actions expression, not a copied predicate.
const workflowAllows = (event, eventName) =>
  new Function("github", "startsWith", "contains", `return (${filter});`)(
    { event, event_name: eventName },
    (a, b) =>
      String(a || "")
        .toLowerCase()
        .startsWith(b.toLowerCase()),
    (a, b) =>
      String(a || "")
        .toLowerCase()
        .includes(b.toLowerCase()),
  );

for (const action of ["created", "edited"]) {
  for (const [name, body] of [
    ["receipt", receipt],
    ["summary", summary],
    ["legacy", "Codex Review: Didn't find any major issues."],
  ]) {
    test(`workflow filter and runtime route ${action} ${name}`, () => {
      const event = commentEvent(body, action);
      assert.equal(workflowAllows(event, "issue_comment"), true);
      assert.equal(shouldRouteAiReviewRerunEvent(event), true);
      assert.equal(
        shouldRouteAiReviewRerunEvent({
          ...event,
          comment: {
            ...event.comment,
            user: { login: "attacker[bot]", type: "Bot" },
          },
        }),
        false,
      );
    });
  }
}
test("workflow subscribes to created/edited and gate completion; runtime restricts completion source", () => {
  assert.match(workflow, /issue_comment:\s*types: \[created, edited\]/);
  assert.match(
    workflow,
    /workflow_run:\s*workflows: \[AI Review\]\s*types: \[completed\]/,
  );
  assert.equal(workflowAllows(completed, "workflow_run"), true);
  assert.equal(shouldRouteAiReviewRerunEvent(completed), true);
  for (const patch of [
    { name: "AI Review Rerun" },
    { path: ".github/workflows/other.yml" },
    { event: "workflow_dispatch" },
  ]) {
    assert.equal(
      shouldRouteAiReviewRerunEvent({
        ...completed,
        workflow_run: { ...completed.workflow_run, ...patch },
      }),
      false,
    );
  }
});

async function route(
  event,
  {
    run = baseRun,
    comments = [commentEvent().comment],
    head = HEAD,
    headBeforePost = head,
    pullsMissing = false,
  } = {},
) {
  const posts = [];
  let pullReads = 0;
  const request = async (_token, _repo, path, options = {}) => {
    if (options.method === "POST") {
      posts.push(path);
      return null;
    }
    if (/\/pulls\/7$/.test(path))
      return {
        number: 7,
        state: "open",
        head: { sha: ++pullReads === 1 ? head : headBeforePost },
      };
    if (path.includes("/commits/"))
      return [{ number: 7, state: "open", head: { sha: HEAD } }];
    if (path.includes("/actions/workflows/")) return { workflow_runs: [run] };
    if (path.includes("/issues/7/comments")) return comments;
    if (path.includes("/pulls/7/reviews")) return [];
    throw new Error(`Unexpected ${path}`);
  };
  const result = await routeAiReviewRerun({
    token: "fixture",
    repository: "owner/repo",
    event: pullsMissing
      ? { ...event, workflow_run: { ...event.workflow_run, pull_requests: [] } }
      : event,
    request,
  });
  return { ...result, posts };
}
test("completed failure requeues after a receipt; a successful check also re-evaluates new evidence", async () => {
  for (const conclusion of ["failure", "success"]) {
    const result = await route(commentEvent(), {
      run: { ...baseRun, conclusion },
    });
    assert.equal(result.action, "rerun");
    assert.deepEqual(result.posts, ["/repos/owner/repo/actions/runs/99/rerun"]);
  }
});
test("edited pre-existing summary uses updated_at to wake a completed gate", async () => {
  const result = await route(
    commentEvent(summary, "edited", {
      created_at: "2026-10-14T10:00:00Z",
      updated_at: "2026-10-15T10:02:00Z",
    }),
  );
  assert.equal(result.action, "rerun");
});
test("evidence while gate is active is reconciled on completion exactly once", async () => {
  const active = await route(commentEvent(), {
    run: { ...baseRun, status: "in_progress" },
  });
  assert.equal(active.action, "already_running");
  assert.equal(active.posts.length, 0);
  const finished = await route(completed);
  assert.equal(finished.action, "rerun");
  const reconciled = await route(completed, {
    run: { ...baseRun, run_started_at: "2026-10-15T10:04:00Z" },
  });
  assert.equal(reconciled.action, "evidence_observed");
  assert.equal(reconciled.posts.length, 0);
});
test("completion reconciliation works with an empty workflow_run PR list", async () => {
  assert.equal(
    (await route(completed, { pullsMissing: true })).action,
    "rerun",
  );
});
test("no evidence and unrelated bot output never loop a failed gate", async () => {
  for (const comments of [
    [],
    [{ ...commentEvent().comment, user: { login: "attacker[bot]" } }],
  ]) {
    assert.equal((await route(completed, { comments })).posts.length, 0);
  }
  assert.equal(
    selectAiReviewRun([baseRun], HEAD, "2026-10-15T09:59:00Z").action,
    "evidence_observed",
  );
});
test("current-head selection and pre-POST refresh protect against pushes", async () => {
  const newer = "b".repeat(40);
  assert.equal((await route(completed, { head: newer })).action, "stale_head");
  assert.equal(
    (await route(commentEvent(), { headBeforePost: newer })).action,
    "stale_head",
  );
  assert.equal(
    (
      await route({
        review: { user: BOT, commit_id: newer },
        pull_request: { number: 7 },
      })
    ).action,
    "stale_head",
  );
  assert.equal(
    selectAiReviewRun(
      [{ ...baseRun, head_sha: newer }],
      HEAD,
      "2026-10-15T10:02:00Z",
    ).action,
    "not_found",
  );
});

test("a concurrent rerun conflict is accepted only after observing an active exact-head run", async () => {
  let reads = 0;
  const { rerunAiReviewForPrHead } =
    await import("../scripts/ai-review-rerun.mjs");
  const request = async (_token, _repo, _path, options = {}) => {
    if (options.method === "POST")
      throw Object.assign(new Error("already running"), { status: 409 });
    return {
      workflow_runs: [
        { ...baseRun, status: ++reads > 1 ? "in_progress" : "completed" },
      ],
    };
  };
  const result = await rerunAiReviewForPrHead({
    token: "fixture",
    repository: "owner/repo",
    headSha: HEAD,
    evidenceCreatedAt: "2026-10-15T10:02:00Z",
    request,
  });
  assert.equal(result.action, "already_running");
});

test("completion reconciliation accepts the documented workflow path with an @ref suffix", async () => {
  for (const ref of ["main", "refs/pull/48/merge", HEAD]) {
    const event = {
      ...completed,
      workflow_run: {
        ...completed.workflow_run,
        path: `.github/workflows/ai-review.yml@${ref}`,
      },
    };
    assert.equal(shouldRouteAiReviewRerunEvent(event), true);
    const result = await route(event);
    assert.equal(result.action, "rerun");
    assert.deepEqual(result.posts, ["/repos/owner/repo/actions/runs/99/rerun"]);
    const reconciled = await route(event, {
      run: { ...baseRun, run_started_at: "2026-10-15T10:04:00Z" },
    });
    assert.equal(reconciled.action, "evidence_observed");
  }
  assert.equal(
    shouldRouteAiReviewRerunEvent({
      ...completed,
      workflow_run: {
        ...completed.workflow_run,
        path: ".github/workflows/other.yml@main",
      },
    }),
    false,
  );
});
