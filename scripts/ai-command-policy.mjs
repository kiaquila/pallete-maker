#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  createAiReviewRequestMarkerBody,
  isTrustedAssociation,
} from "./ai-review-helpers.mjs";
import { readConfig } from "./shared.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;
const config = readConfig();

if (!token || !repository || !eventPath) {
  console.error(
    "GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_EVENT_PATH are required.",
  );
  process.exit(1);
}

const [owner, repo] = repository.split("/");
const event = JSON.parse(readFileSync(eventPath, "utf8"));
const body = String(event.comment?.body || "");
const bodyLower = body.toLowerCase();
const prNumber = event.issue?.number;
const authorAssociation = event.comment?.author_association;
const commentAuthorType = event.comment?.user?.type;
const commentAuthorLogin = String(
  event.comment?.user?.login || "",
).toLowerCase();

if (
  commentAuthorType === "Bot" ||
  commentAuthorLogin === "github-actions[bot]"
) {
  console.log("AI command ignored: comment was posted by a bot.");
  process.exit(0);
}

function requestedCommand(commandBody) {
  if (commandBody.includes("@claude review once")) {
    return { kind: "review", agent: "claude" };
  }
  if (commandBody.includes("@codex review")) {
    return { kind: "review", agent: "codex" };
  }
  if (
    commandBody.includes("/gemini review") ||
    commandBody.includes("@gemini-code-assist review")
  ) {
    return { kind: "review", agent: "gemini" };
  }
  if (commandBody.includes("@claude")) {
    return { kind: "implementation", agent: "claude" };
  }
  if (commandBody.includes("@codex")) {
    return { kind: "implementation", agent: "codex" };
  }
  return null;
}

async function request(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${await response.text()}`,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

async function createComment(commentBody) {
  return request(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: commentBody }),
  });
}

const command = requestedCommand(bodyLower);
if (!command) {
  process.exit(0);
}

const lines = [];
if (!event.issue?.pull_request && command.kind === "review") {
  lines.push("AI command rejected: review commands only run on pull requests.");
}
if (!isTrustedAssociation(authorAssociation)) {
  lines.push(
    "AI command rejected: only OWNER, MEMBER, and COLLABORATOR comments are trusted.",
  );
}

const defaults = {
  implementation: config.defaultImplementationAgent || "claude",
  review: config.defaultReviewAgent || "codex",
};
const selected = String(
  command.kind === "review"
    ? process.env.AI_REVIEW_AGENT || defaults.review
    : process.env.AI_IMPLEMENTATION_AGENT || defaults.implementation,
)
  .trim()
  .toLowerCase();
const allowed =
  command.kind === "review"
    ? new Set(["codex", "claude", "gemini"])
    : new Set(["claude", "codex"]);

if (!allowed.has(selected)) {
  lines.push(`AI command rejected: unsupported selected agent '${selected}'.`);
}

if (selected !== command.agent) {
  const expected =
    command.kind === "review"
      ? selected === "claude"
        ? "@claude review once"
        : selected === "gemini"
          ? "/gemini review"
          : "@codex review"
      : selected === "claude"
        ? "@claude <task brief>"
        : "start the Codex task from Codex app or Codex web";
  lines.push(
    "Policy mismatch for AI command routing.",
    "",
    `Requested ${command.kind} agent: \`${command.agent}\``,
    `Selected ${command.kind} agent from repository policy: \`${selected}\``,
    "",
    `Use ${selected === "codex" && command.kind === "implementation" ? expected : `\`${expected}\``} or update the repository variable before rerunning the command.`,
  );
}

if (lines.length) {
  await createComment(lines.join("\n"));
  console.error(lines.join(" "));
  process.exit(1);
}

if (command.kind === "review") {
  const pull = await request(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  const headSha = pull.head?.sha;
  const sourceCommentId = String(event.comment.id);
  const requestedAt = event.comment.created_at || new Date().toISOString();
  const requestId = `${sourceCommentId}-${String(headSha).slice(0, 12)}`;

  await createComment(
    createAiReviewRequestMarkerBody({
      agent: selected,
      headSha,
      requestId,
      sourceCommentId,
      sourceCommentCreatedAt: event.comment.created_at,
      requestedAt,
    }),
  );
}

console.log(`Trusted AI ${command.kind} command for ${selected}.`);
