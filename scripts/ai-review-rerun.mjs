#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  extractClaudeOutcome,
  createNativeReviewEditMarker,
  extractNativeReviewEditMarker,
  nativeReviewTimestamp,
  isCodexEvidenceBody,
  isTrustedReviewLogin,
} from "./ai-review-helpers.mjs";
import { readConfig } from "./shared.mjs";

const rerunnableConclusions = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "action_required",
  "startup_failure",
]);
const activeStatuses = new Set([
  "queued",
  "in_progress",
  "waiting",
  "requested",
  "pending",
]);

function normalizeAgent(agent) {
  return String(agent || "codex")
    .trim()
    .toLowerCase();
}

export function shouldRouteAiReviewRerunEvent(
  event,
  selectedAgent = "codex",
  config = {},
) {
  const agent = normalizeAgent(selectedAgent);

  if (event?.workflow_run) {
    return (
      event.action === "completed" &&
      event.workflow_run.name === "AI Review" &&
      event.workflow_run.event === "pull_request" &&
      String(event.workflow_run.path || "").split("@", 1)[0] ===
        ".github/workflows/ai-review.yml"
    );
  }

  if (event?.review) {
    return (
      ["codex", "gemini"].includes(agent) &&
      isTrustedReviewLogin(event.review.user?.login, agent, config)
    );
  }

  if (!event?.issue?.pull_request || !event?.comment) return false;
  const body = String(event.comment.body || "");
  const login = event.comment.user?.login;

  if (agent === "codex") {
    return (
      (isCodexEvidenceBody(body) || event.action === "edited") &&
      isTrustedReviewLogin(login, "codex", config)
    );
  }

  if (agent === "claude") {
    return (
      Boolean(extractClaudeOutcome(body)) &&
      isTrustedReviewLogin(login, "claude", config)
    );
  }

  return false;
}

function latestRunActivityTime(run) {
  return Date.parse(
    run?.updated_at || run?.run_started_at || run?.created_at || "",
  );
}

export function selectAiReviewRun(runs = [], headSha, evidenceCreatedAt = "") {
  const matchingRuns = runs
    .filter((run) => run.event === "pull_request" && run.head_sha === headSha)
    .sort(
      (left, right) =>
        latestRunActivityTime(right) - latestRunActivityTime(left),
    );

  const activeRun = matchingRuns.find((run) => activeStatuses.has(run.status));
  if (activeRun) {
    return { action: "already_running", run: activeRun };
  }

  const evidenceTime = Date.parse(evidenceCreatedAt || "");
  const latestCompletedRun = matchingRuns.find(
    (run) => run.status === "completed",
  );
  // Reconcile evidence against the attempt start, not completion: evidence can
  // arrive after the gate's last read while the run is still in progress.
  // GitHub truncates timestamps to seconds, so equality is also fresh evidence.
  const latestCompletedTime = Date.parse(
    latestCompletedRun?.run_started_at || latestCompletedRun?.created_at || "",
  );
  if (
    latestCompletedRun &&
    Number.isFinite(evidenceTime) &&
    (!Number.isFinite(latestCompletedTime) ||
      latestCompletedTime <= evidenceTime)
  ) {
    return { action: "rerun", run: latestCompletedRun };
  }

  if (latestCompletedRun?.conclusion === "success") {
    return { action: "already_success", run: latestCompletedRun };
  }
  if (latestCompletedRun && Number.isFinite(evidenceTime)) {
    return { action: "evidence_observed", run: latestCompletedRun };
  }
  if (rerunnableConclusions.has(latestCompletedRun?.conclusion)) {
    return { action: "rerun", run: latestCompletedRun };
  }

  return { action: "not_found", run: null };
}

async function defaultRequest(token, repository, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `${response.status} ${response.statusText}: ${text}`,
    );
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

async function listPaginated(request, token, repository, path) {
  const items = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let page = 1; ; page += 1) {
    const data = await request(
      token,
      repository,
      `${path}${separator}per_page=100&page=${page}`,
    );
    const batch = data.workflow_runs || data;
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

export async function rerunAiReviewForPrHead({
  token,
  repository,
  headSha,
  evidenceCreatedAt = "",
  prNumber,
  request = defaultRequest,
}) {
  if (!token || !repository || !headSha) {
    throw new Error(
      "token, repository, and headSha are required to rerun AI Review.",
    );
  }

  const [owner, repo] = repository.split("/");
  const runs = await listPaginated(
    request,
    token,
    repository,
    `/repos/${owner}/${repo}/actions/workflows/ai-review.yml/runs?event=pull_request&head_sha=${encodeURIComponent(headSha)}`,
  );
  const selected = selectAiReviewRun(runs, headSha, evidenceCreatedAt);

  if (selected.action === "rerun") {
    if (prNumber) {
      const current = await request(
        token,
        repository,
        `/repos/${owner}/${repo}/pulls/${prNumber}`,
      );
      if (current.state !== "open" || current.head?.sha !== headSha) {
        return {
          action: "stale_head",
          run: null,
          message: "PR head changed before rerun; ignoring old evidence.",
        };
      }
    }
    try {
      await request(
        token,
        repository,
        `/repos/${owner}/${repo}/actions/runs/${selected.run.id}/rerun`,
        { method: "POST" },
      );
    } catch (error) {
      if (![409, 422].includes(error.status)) throw error;
      const refreshed = await listPaginated(
        request,
        token,
        repository,
        `/repos/${owner}/${repo}/actions/workflows/ai-review.yml/runs?event=pull_request&head_sha=${encodeURIComponent(headSha)}`,
      );
      const concurrent = selectAiReviewRun(
        refreshed,
        headSha,
        evidenceCreatedAt,
      );
      if (concurrent.action !== "already_running") throw error;
      return {
        ...concurrent,
        message: `Concurrent evidence already requeued AI Review for ${headSha}.`,
      };
    }
    return {
      ...selected,
      message: `Requested AI Review rerun for ${headSha} from run ${selected.run.id}.`,
    };
  }

  const runId = selected.run?.id ? ` run ${selected.run.id}` : "";
  const messages = {
    already_running: `AI Review is already running for ${headSha}${runId}.`,
    already_success: `AI Review already passed for ${headSha}${runId}.`,
    evidence_observed: `AI Review already evaluated this evidence for ${headSha}${runId}.`,
    not_found: `No completed AI Review pull_request run found for ${headSha}.`,
  };

  return {
    ...selected,
    message: messages[selected.action],
  };
}

async function resolvePullContext({
  token,
  repository,
  event,
  request = defaultRequest,
}) {
  let prNumber =
    event?.pull_request?.number ||
    (event?.issue?.pull_request && event.issue.number) ||
    event?.workflow_run?.pull_requests?.[0]?.number;
  if (!prNumber && event?.workflow_run?.head_sha) {
    const pulls = await listPaginated(
      request,
      token,
      repository,
      `/repos/${repository}/commits/${event.workflow_run.head_sha}/pulls`,
    );
    prNumber = pulls.find(
      (pull) =>
        pull.state === "open" && pull.head?.sha === event.workflow_run.head_sha,
    )?.number;
  }
  if (!prNumber) return null;
  const pull = await request(
    token,
    repository,
    `/repos/${repository}/pulls/${prNumber}`,
  );
  if (pull.state !== "open") return null;
  return { prNumber: pull.number, headSha: pull.head?.sha };
}

export function evidenceTimestamp(event, observedAt = "") {
  return (
    (event?.review && ["edited", "dismissed"].includes(event.action)
      ? observedAt
      : "") ||
    event?.review?.updated_at ||
    event?.review?.submitted_at ||
    event?.comment?.updated_at ||
    event?.comment?.created_at ||
    ""
  );
}

export async function routeAiReviewRerun({
  token,
  repository,
  event,
  selectedAgent = "codex",
  config = {},
  observedAt = "",
  sourceRunId = "",
  request = defaultRequest,
}) {
  if (!shouldRouteAiReviewRerunEvent(event, selectedAgent, config)) {
    return {
      action: "ignored",
      message: "Event is not trusted selected-reviewer evidence.",
    };
  }
  const context = await resolvePullContext({
    token,
    repository,
    event,
    request,
  });
  if (
    !context ||
    (event.review?.commit_id && event.review.commit_id !== context.headSha) ||
    (event.workflow_run && event.workflow_run.head_sha !== context.headSha)
  ) {
    return {
      action: "stale_head",
      message: "Event is not for an open current PR head.",
    };
  }
  let timestamp = evidenceTimestamp(event, observedAt);
  if (event.review && ["edited", "dismissed"].includes(event.action)) {
    if (!observedAt || !sourceRunId)
      throw new Error(
        "Formal review edits require the trusted workflow run's time and ID.",
      );
    const body = createNativeReviewEditMarker({
      agent: normalizeAgent(selectedAgent),
      headSha: context.headSha,
      review: event.review,
      observedAt,
      sourceRunId,
    });
    const existing = await listPaginated(
      request,
      token,
      repository,
      `/repos/${repository}/issues/${context.prNumber}/comments`,
    );
    if (
      !existing.some(
        (comment) =>
          comment.body === body && extractNativeReviewEditMarker(comment),
      )
    ) {
      const posted = await request(
        token,
        repository,
        `/repos/${repository}/issues/${context.prNumber}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (!extractNativeReviewEditMarker(posted))
        throw new Error(
          "Formal edit ordering must be recorded by github-actions[bot].",
        );
    }
  }
  if (event.workflow_run) {
    // Completion closes the active-run race. A second attempt starts after the
    // same evidence, so its completion cannot create an endless rerun loop.
    const [comments, reviews] = await Promise.all([
      listPaginated(
        request,
        token,
        repository,
        `/repos/${repository}/issues/${context.prNumber}/comments`,
      ),
      listPaginated(
        request,
        token,
        repository,
        `/repos/${repository}/pulls/${context.prNumber}/reviews`,
      ),
    ]);
    // REST no longer contains an edit's prior body. Reconcile all selected
    // Codex comment updates so a retraction during an active gate is not lost.
    const timestamps = [
      ...comments
        .filter((comment) =>
          normalizeAgent(selectedAgent) === "codex"
            ? isTrustedReviewLogin(comment.user?.login, "codex", config)
            : shouldRouteAiReviewRerunEvent(
                { issue: { pull_request: {} }, comment },
                selectedAgent,
                config,
              ),
        )
        .map((comment) => evidenceTimestamp({ comment })),
      ...reviews
        .filter(
          (review) =>
            review.commit_id === context.headSha &&
            shouldRouteAiReviewRerunEvent({ review }, selectedAgent, config),
        )
        .map((review) =>
          new Date(
            nativeReviewTimestamp(
              review,
              comments,
              normalizeAgent(selectedAgent),
              context.headSha,
            ),
          ).toISOString(),
        ),
    ].filter((time) => Number.isFinite(Date.parse(time)));
    timestamp = timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    if (!timestamp)
      return {
        action: "ignored",
        message: "No trusted evidence to reconcile.",
      };
  }
  return rerunAiReviewForPrHead({
    token,
    repository,
    ...context,
    evidenceCreatedAt: timestamp,
    request,
  });
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!token || !repository || !eventPath)
    throw new Error(
      "GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_EVENT_PATH are required.",
    );
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  let observedAt = "";
  let sourceRunId = "";
  if (event.review && ["edited", "dismissed"].includes(event.action)) {
    if (!process.env.GITHUB_RUN_ID)
      throw new Error("GITHUB_RUN_ID is required to timestamp a formal edit.");
    const run = await defaultRequest(
      token,
      repository,
      `/repos/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    );
    observedAt = run.created_at;
    sourceRunId = String(run.id);
  }
  const result = await routeAiReviewRerun({
    token,
    repository,
    event,
    observedAt,
    sourceRunId,
    selectedAgent: normalizeAgent(process.env.AI_REVIEW_AGENT),
    config: readConfig(),
  });
  console.log(result.message);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(`AI Review rerun failed: ${error.message}`);
    process.exit(1);
  }
}
