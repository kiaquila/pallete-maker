const reviewerBotLogins = new Set([
  "chatgpt-codex-connector[bot]",
  "gemini-code-assist[bot]",
  "claude[bot]",
]);

export const codexReviewerLogins = new Set(["chatgpt-codex-connector[bot]"]);
export const trustedAssociations = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const codexSummaryPrefix = /^Codex Review:/i;
const codexNoIssuesPattern =
  /did(?:\s+not|\s*n['’]?t)\s+find\s+any\s+major\s+issues/i;
const codexEnvironmentPattern = /create an environment for this repo/i;
const codexAccountPattern = /create a codex account and connect to github/i;
const codexTriggerPattern = /@codex review\b/i;

const getBody = (entry) => (entry?.body || "").trim();
const getLogin = (entry) => entry?.user?.login || "";

export const normalizeLogin = (login) => String(login || "").toLowerCase();

export const isTrustedAssociation = (value) =>
  trustedAssociations.has(String(value || "").toUpperCase());

export const extractClaudeOutcome = (body) => {
  const match = String(body || "").match(
    /^AI_REVIEW_OUTCOME:\s*(pass|advisory|block)\s*$/im,
  );
  return match ? match[1].toLowerCase() : null;
};

export const extractMarkerSha = (body) => {
  const match = String(body || "").match(
    /^AI_REVIEW_SHA:\s*([a-f0-9]{7,40})\s*$/im,
  );
  return match?.[1] || null;
};

export const createAiReviewRequestMarkerBody = ({
  agent,
  headSha,
  requestId,
  sourceCommentId,
  sourceCommentCreatedAt,
  requestedAt,
}) => {
  const recordedAt = requestedAt || new Date().toISOString();
  return [
    `AI review request recorded for \`${String(headSha || "").slice(0, 10)}\`.`,
    "",
    "<!-- unicorn-hub:ai-review-request",
    `AI_REVIEW_REQUEST_ID: ${requestId}`,
    `AI_REVIEW_AGENT: ${String(agent || "")
      .trim()
      .toLowerCase()}`,
    `AI_REVIEW_SHA: ${headSha}`,
    `AI_REVIEW_SOURCE_COMMENT_ID: ${sourceCommentId}`,
    `AI_REVIEW_SOURCE_COMMENT_CREATED_AT: ${sourceCommentCreatedAt || recordedAt}`,
    `AI_REVIEW_REQUESTED_AT: ${recordedAt}`,
    "-->",
  ].join("\n");
};

export const extractAiReviewRequestMarker = (body) => {
  const text = String(body || "");
  if (!text.includes("unicorn-hub:ai-review-request")) return null;

  const field = (name) =>
    text.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, "im"))?.[1]?.trim() ||
    null;
  const requestId = field("AI_REVIEW_REQUEST_ID");
  const agent = field("AI_REVIEW_AGENT")?.toLowerCase();
  const sha = field("AI_REVIEW_SHA");
  const sourceCommentId = field("AI_REVIEW_SOURCE_COMMENT_ID");
  const sourceCommentCreatedAt = field("AI_REVIEW_SOURCE_COMMENT_CREATED_AT");
  const requestedAt = field("AI_REVIEW_REQUESTED_AT");

  if (!requestId || !agent || !sha || !sourceCommentId || !requestedAt) {
    return null;
  }
  if (!/^[a-f0-9]{7,40}$/i.test(sha)) return null;

  return {
    requestId,
    agent,
    sha,
    sourceCommentId,
    sourceCommentCreatedAt,
    requestedAt,
  };
};

const defaultTrustedReviewLogins = {
  codex: ["chatgpt-codex-connector[bot]"],
  claude: ["claude[bot]"],
  gemini: ["gemini-code-assist[bot]"],
};

const botLoginPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\[bot\]$/;

const sanitizeBotLogins = (logins) =>
  (Array.isArray(logins) ? logins : [])
    .map(normalizeLogin)
    .filter((login) => botLoginPattern.test(login));

export const trustedReviewLoginsForAgent = (agent, config = {}) =>
  new Set([
    ...(defaultTrustedReviewLogins[agent] || []).map(normalizeLogin),
    ...sanitizeBotLogins(config.trustedReviewLogins),
    ...sanitizeBotLogins(config.trustedReviewLoginsByAgent?.[agent]),
  ]);

export const isTrustedReviewLogin = (login, agent, config = {}) =>
  trustedReviewLoginsForAgent(agent, config).has(normalizeLogin(login));

export const latestAiReviewRequestMarker = (comments = [], agent, headSha) =>
  comments
    .map((comment) => {
      const marker = extractAiReviewRequestMarker(comment?.body);
      if (!marker) return null;
      return {
        ...marker,
        commentId: String(comment.id || ""),
        commentCreatedAt: comment.created_at || null,
        author: comment.user?.login || null,
      };
    })
    .filter(
      (marker) =>
        marker &&
        normalizeLogin(marker.author) === "github-actions[bot]" &&
        marker.agent === String(agent || "").toLowerCase() &&
        marker.sha === headSha,
    )
    .sort(
      (left, right) =>
        Date.parse(right.commentCreatedAt || right.requestedAt || "") -
        Date.parse(left.commentCreatedAt || left.requestedAt || ""),
    )[0] || null;

const isCommentEvent = (entry) => !entry?.event || entry.event === "commented";

const isCodexBotComment = (entry) =>
  isCommentEvent(entry) && codexReviewerLogins.has(getLogin(entry));

const isHumanCodexTriggerComment = (entry) =>
  isCommentEvent(entry) &&
  codexTriggerPattern.test(getBody(entry)) &&
  !reviewerBotLogins.has(getLogin(entry));

const isCurrentHeadActivationEvent = (entry, headSha) =>
  (entry?.event === "committed" && entry?.sha === headSha) ||
  ((entry?.event === "head_ref_force_pushed" ||
    entry?.event === "head_ref_restored") &&
    entry?.commit_id === headSha);

export const matchesCodexReview = (review, headSha) =>
  review?.commit_id === headSha &&
  codexReviewerLogins.has(review?.user?.login || "") &&
  (review?.body || "").includes("Codex Review");

export const matchesCodexSummaryComment = (comment) =>
  isCodexBotComment(comment) && codexSummaryPrefix.test(getBody(comment));

export const classifyCodexSetupReply = (comment) => {
  const body = getBody(comment);

  if (codexEnvironmentPattern.test(body)) {
    return {
      outcome: "fail",
      reason:
        "Codex could not start the selected review because no Codex cloud environment is configured for this repository.",
      details: [comment.html_url],
    };
  }

  if (codexAccountPattern.test(body)) {
    return {
      outcome: "fail",
      reason:
        "Codex could not start the selected review because the trigger did not come from a connected human Codex account.",
      details: [comment.html_url],
    };
  }

  return null;
};

export const classifyCodexSummaryComment = (comment) => {
  const body = getBody(comment);

  if (codexNoIssuesPattern.test(body)) {
    return {
      outcome: "pass",
      reason: "Codex completed review with no major issues.",
      details: [comment.html_url],
    };
  }

  return {
    outcome: "pending",
    reason:
      "Codex summary comment did not match a recognized no-findings reply.",
    details: [comment.html_url],
  };
};

export const findLatestHeadActivationIndex = (timelineEvents, headSha) => {
  if (!Array.isArray(timelineEvents) || !headSha) {
    return -1;
  }

  for (let index = timelineEvents.length - 1; index >= 0; index -= 1) {
    if (isCurrentHeadActivationEvent(timelineEvents[index], headSha)) {
      return index;
    }
  }

  return -1;
};

export const pickAuthoritativeCodexSkipModeComment = ({
  timelineEvents,
  headSha,
}) => {
  if (
    !Array.isArray(timelineEvents) ||
    timelineEvents.length === 0 ||
    !headSha
  ) {
    return null;
  }

  const activationIndex = findLatestHeadActivationIndex(
    timelineEvents,
    headSha,
  );
  if (activationIndex < 0) {
    return null;
  }

  let boundaryIndex = activationIndex;
  for (
    let index = activationIndex + 1;
    index < timelineEvents.length;
    index += 1
  ) {
    if (isHumanCodexTriggerComment(timelineEvents[index])) {
      boundaryIndex = index;
    }
  }

  const latestCodexComment =
    timelineEvents
      .slice(boundaryIndex + 1)
      .filter((entry) => isCodexBotComment(entry))
      .at(-1) || null;

  if (!latestCodexComment) {
    return null;
  }

  const setupClassification = classifyCodexSetupReply(latestCodexComment);
  if (setupClassification) {
    return {
      comment: latestCodexComment,
      classification: setupClassification,
      reviewState: "SETUP_REQUIRED",
      boundaryType:
        boundaryIndex === activationIndex ? "head-activation" : "human-trigger",
    };
  }

  if (!matchesCodexSummaryComment(latestCodexComment)) {
    return null;
  }

  const summaryClassification = classifyCodexSummaryComment(latestCodexComment);
  if (summaryClassification.outcome === "pending") {
    return null;
  }

  return {
    comment: latestCodexComment,
    classification: summaryClassification,
    reviewState: "COMMENTED_NO_FINDINGS",
    boundaryType:
      boundaryIndex === activationIndex ? "head-activation" : "human-trigger",
  };
};
