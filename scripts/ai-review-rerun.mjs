#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  extractClaudeOutcome,
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

function isCodexEvidenceBody(body) {
  const text = String(body || "");
  return (
    /^Codex Review:/i.test(text) ||
    /create an environment for this repo/i.test(text) ||
    /create a codex account and connect to github/i.test(text)
  );
}

export function shouldRouteAiReviewRerunEvent(
  event,
  selectedAgent = "codex",
  config = {},
) {
  const agent = normalizeAgent(selectedAgent);

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
      isCodexEvidenceBody(body) && isTrustedReviewLogin(login, "codex", config)
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

export function selectAiReviewRun(runs = [], headSha, evidenceCreatedAt = "") {
  const matchingRuns = runs
    .filter((run) => run.event === "pull_request" && run.head_sha === headSha)
    .sort(
      (left, right) =>
        Date.parse(right.created_at || "") - Date.parse(left.created_at || ""),
    );

  const activeRun = matchingRuns.find((run) => activeStatuses.has(run.status));
  if (activeRun) {
    return { action: "already_running", run: activeRun };
  }

  const evidenceTime = Date.parse(evidenceCreatedAt || "");
  const latestCompletedRun = matchingRuns.find(
    (run) => run.status === "completed",
  );
  const latestCompletedTime = Date.parse(latestCompletedRun?.created_at || "");
  if (
    latestCompletedRun &&
    Number.isFinite(evidenceTime) &&
    (!Number.isFinite(latestCompletedTime) ||
      latestCompletedTime < evidenceTime)
  ) {
    return { action: "rerun", run: latestCompletedRun };
  }

  if (latestCompletedRun?.conclusion === "success") {
    return { action: "already_success", run: latestCompletedRun };
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
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
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
    await request(
      token,
      repository,
      `/repos/${owner}/${repo}/actions/runs/${selected.run.id}/rerun`,
      { method: "POST" },
    );
    return {
      ...selected,
      message: `Requested AI Review rerun for ${headSha} from run ${selected.run.id}.`,
    };
  }

  const runId = selected.run?.id ? ` run ${selected.run.id}` : "";
  const messages = {
    already_running: `AI Review is already running for ${headSha}${runId}.`,
    already_success: `AI Review already passed for ${headSha}${runId}.`,
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
  if (event?.pull_request) {
    return {
      prNumber: event.pull_request.number,
      headSha: event.pull_request.head?.sha,
    };
  }

  if (!event?.issue?.pull_request || !event?.issue?.number) {
    throw new Error("Could not resolve pull request from event.");
  }

  const [owner, repo] = repository.split("/");
  const pull = await request(
    token,
    repository,
    `/repos/${owner}/${repo}/pulls/${event.issue.number}`,
  );
  return {
    prNumber: pull.number,
    headSha: pull.head?.sha,
  };
}

function evidenceTimestamp(event) {
  return (
    event?.review?.submitted_at ||
    event?.comment?.updated_at ||
    event?.comment?.created_at ||
    ""
  );
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const selectedAgent = normalizeAgent(process.env.AI_REVIEW_AGENT);
  const config = readConfig();

  if (!token || !repository || !eventPath) {
    console.error(
      "GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_EVENT_PATH are required.",
    );
    process.exit(1);
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  if (!shouldRouteAiReviewRerunEvent(event, selectedAgent, config)) {
    console.log(
      "AI Review rerun skipped: event is not trusted review evidence for the selected agent.",
    );
    return;
  }

  const context = await resolvePullContext({ token, repository, event });
  const result = await rerunAiReviewForPrHead({
    token,
    repository,
    headSha: context.headSha,
    evidenceCreatedAt: evidenceTimestamp(event),
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
