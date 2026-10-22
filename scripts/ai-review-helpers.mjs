import {
  hasCleanCodexState,
  codexNegativeCompletionTime,
  isCodexStateBody,
  codexCodeReviewCompletionTime,
} from "./codex-review-state.mjs";
import { createHash } from "node:crypto";

const reviewerBotLogins = new Set([
  "chatgpt-codex-connector[bot]",
  "gemini-code-assist[bot]",
  "claude[bot]",
]);

export const codexReviewerLogins = new Set(["chatgpt-codex-connector[bot]"]);
export const trustedAssociations = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const codexSummaryPrefix = /^Codex Review:/i;
const codexReceiptMarker = "<!-- codex-review-receipt:v1 -->";
const codexNoIssuesPattern =
  /^Codex Review: did(?:\s+not|\s*n['’]?t)\s+find\s+any\s+major\s+issues\.([^\r\n]*)$/i;
// Observed connector sign-offs are presentation text, not additional verdicts.
// Unknown prose fails closed instead of accepting a contradictory second sentence.
const codexSignoffs = new Set([
  "",
  "nice work!",
  "keep it up!",
  "looks good!",
  "breezy!",
  "bravo.",
  "can't wait for the next one!",
  "chef's kiss.",
  "delightful!",
  "hooray!",
  "keep them coming!",
  "more of your lovely prs please.",
  "what shall we delve into next?",
  "you're on a roll.",
]);
const hasCodexNoIssuesVerdict = (body) => {
  const match = body.match(codexNoIssuesPattern);
  if (!match) return false;
  const signoff = match[1]
    .trim()
    .replace(/(?:\s*(?::[a-z0-9_+-]+:|🚀|🎉))+$/i, "")
    .trim()
    .toLowerCase();
  return codexSignoffs.has(signoff);
};
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
  isTrustedAssociation(entry.author_association) &&
  entry.user?.type !== "Bot" &&
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
  isCodexBotComment(comment) &&
  (codexSummaryPrefix.test(getBody(comment)) ||
    isCodexStateBody(getBody(comment)) ||
    getBody(comment).startsWith("<!-- codex-review-receipt:"));

// Routing is broad; the strict state classifier owns affirmative evidence.
export const isCodexEvidenceBody = (body) => {
  const text = String(body || "").trim();
  return (
    isCodexStateBody(text) ||
    codexSummaryPrefix.test(text) ||
    text.startsWith("<!-- codex-review-receipt:") ||
    text.startsWith("<!-- codex-pull-request-review-summary -->") ||
    codexEnvironmentPattern.test(text) ||
    codexAccountPattern.test(text)
  );
};

export const codexCommentTimestamp = (comment) =>
  Date.parse(comment.updated_at || comment.created_at || "");

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

export const classifyCodexSummaryComment = (comment, headSha) => {
  const pending = {
    outcome: "pending",
    reason:
      "Codex comment lacks an unambiguous current-head no-findings verdict.",
    details: [comment?.html_url],
  };
  if (!matchesCodexSummaryComment(comment)) return pending;
  if (isCodexStateBody(getBody(comment))) {
    return hasCleanCodexState(getBody(comment), headSha)
      ? {
          outcome: "pass",
          reason:
            "Codex completed current-head structured review with no findings.",
          details: [comment.html_url],
        }
      : pending;
  }
  let body = getBody(comment);
  const receipt = body.startsWith("<!-- codex-review-receipt:");
  if (receipt) {
    if (!body.startsWith(`${codexReceiptMarker}\n`)) return pending;
    body = body.slice(codexReceiptMarker.length).trim();
  }
  // Never strip arbitrary HTML or permit duplicate/conflicting machine markers.
  if (
    /<!--\s*codex-/i.test(body) ||
    (body.match(/\*\*Reviewed commit:\*\*/g) || []).length > 1
  )
    return pending;
  const detailsIndex = body.indexOf("<details>");
  if (detailsIndex !== -1) {
    const details = body.slice(detailsIndex);
    if (
      !/^<details>\s*<summary>ℹ️ About Codex in GitHub<\/summary>[\s\S]*<\/details>$/.test(
        details,
      ) ||
      (details.match(/<details>/g) || []).length !== 1 ||
      (details.match(/<\/details>/g) || []).length !== 1
    )
      return pending;
    body = body.slice(0, detailsIndex).trim();
  }
  const shaMatch = body.match(
    /\n\n\*\*Reviewed commit:\*\* `([a-f0-9]{10,40})`$/,
  );
  if (receipt && !shaMatch) return pending;
  if (shaMatch) {
    if (
      !/^[a-f0-9]{40}$/.test(headSha || "") ||
      !headSha.startsWith(shaMatch[1])
    )
      return pending;
    body = body.slice(0, shaMatch.index).trim();
  }
  if (hasCodexNoIssuesVerdict(body)) {
    return {
      outcome: "pass",
      reason: "Codex completed review with no major issues.",
      details: [comment.html_url],
      reviewedSha: shaMatch?.[1] || null,
    };
  }
  return pending;
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

  const events = timelineEvents;
  const allComments = events;
  const statePosition = (entry) =>
    events.findLastIndex(
      (event) =>
        isCommentEvent(event) && entry.id != null && event.id === entry.id,
    );
  const stateBoundaryTime = Date.parse(events[boundaryIndex]?.created_at || "");
  const eligibleState = (entry) => {
    if (activationIndex < 0) return false;
    const completedAt = codexCodeReviewCompletionTime(getBody(entry));
    const activationTime = Date.parse(
      events[activationIndex]?.created_at || "",
    );
    if (
      !Number.isFinite(completedAt) ||
      !Number.isFinite(Date.parse(entry.created_at || "")) ||
      Math.floor(completedAt / 1000) <
        Math.floor(Date.parse(entry.created_at || "") / 1000) ||
      completedAt >= codexCommentTimestamp(entry) + 1000 ||
      (Number.isFinite(stateBoundaryTime) &&
        Math.floor(completedAt / 1000) <=
          Math.floor(stateBoundaryTime / 1000)) ||
      (Number.isFinite(activationTime) &&
        Math.floor(completedAt / 1000) <= Math.floor(activationTime / 1000))
    )
      return false;
    const time = codexCommentTimestamp(entry);
    if (Number.isFinite(stateBoundaryTime)) {
      return (
        time > stateBoundaryTime ||
        (time === stateBoundaryTime &&
          time === Date.parse(entry.created_at) &&
          statePosition(entry) > boundaryIndex)
      );
    }
    return (
      statePosition(entry) > boundaryIndex &&
      time === Date.parse(entry.created_at)
    );
  };
  const evidenceTime = (entry) =>
    Number.isFinite(codexNegativeCompletionTime(entry, headSha))
      ? codexNegativeCompletionTime(entry, headSha)
      : isCodexStateBody(getBody(entry)) &&
          eligibleState(entry) &&
          hasCleanCodexState(getBody(entry), headSha)
        ? Math.floor(codexCodeReviewCompletionTime(getBody(entry)) / 1000) *
          1000
        : !isCodexStateBody(getBody(entry)) &&
            classifyCodexSummaryComment(entry, headSha).outcome === "pass"
          ? Date.parse(entry.created_at || "") || 0
          : codexCommentTimestamp(entry);
  const eligibleStaticApproval = (entry) => {
    const createdAt = Date.parse(entry.created_at || "");
    const entryIndex = timelineEvents.findLastIndex(
      (event) => event === entry || (entry.id != null && event.id === entry.id),
    );
    return (
      Number.isFinite(createdAt) &&
      [activationIndex, boundaryIndex].every((index) => {
        const time = Date.parse(timelineEvents[index]?.created_at || "");
        return (
          !Number.isFinite(time) ||
          createdAt > time ||
          (createdAt === time &&
            codexCommentTimestamp(entry) === createdAt &&
            entryIndex > index)
        );
      })
    );
  };
  const stateComments = allComments.filter(
    (entry) =>
      isCodexBotComment(entry) &&
      isCodexStateBody(getBody(entry)) &&
      eligibleState(entry),
  );

  const boundaryTime = Date.parse(
    timelineEvents[boundaryIndex].created_at || "",
  );
  const latestCandidate =
    timelineEvents
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry, index }) =>
          isCodexBotComment(entry) &&
          (index > boundaryIndex ||
            (Number.isFinite(boundaryTime) &&
              codexCommentTimestamp(entry) > boundaryTime)),
      )
      .sort(
        (a, b) =>
          evidenceTime(b.entry) - evidenceTime(a.entry) ||
          (isCodexStateBody(getBody(a.entry)) ||
          isCodexStateBody(getBody(b.entry))
            ? Number(
                classifyCodexSummaryComment(a.entry, headSha).outcome ===
                  "pass",
              ) -
              Number(
                classifyCodexSummaryComment(b.entry, headSha).outcome ===
                  "pass",
              )
            : 0) ||
          b.index - a.index,
      )[0] || null;
  const latestCodexComment = latestCandidate?.entry;

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

  const summaryClassification =
    isCodexStateBody(getBody(latestCodexComment)) &&
    !eligibleState(latestCodexComment)
      ? {
          outcome: "pending",
          reason:
            "Structured review predates the current request or head activation.",
          details: [latestCodexComment.html_url],
        }
      : classifyCodexSummaryComment(
          latestCandidate.index <= boundaryIndex &&
            !isCodexStateBody(getBody(latestCodexComment)) &&
            !getBody(latestCodexComment).startsWith(codexReceiptMarker)
            ? { ...latestCodexComment, body: "" }
            : latestCodexComment,
          headSha,
        );
  if (
    summaryClassification.outcome === "pass" &&
    !isCodexStateBody(getBody(latestCodexComment)) &&
    !eligibleStaticApproval(latestCodexComment)
  ) {
    summaryClassification.outcome = "pending";
    summaryClassification.reason =
      "Static review predates the current request or head activation.";
  }
  summaryClassification.evidenceTimestamp = evidenceTime(latestCodexComment);

  return {
    comment: latestCodexComment,
    classification: summaryClassification,
    reviewState:
      summaryClassification.outcome === "pass"
        ? "COMMENTED_NO_FINDINGS"
        : "PENDING",
    boundaryType:
      boundaryIndex === activationIndex ? "head-activation" : "human-trigger",
  };
};

// This marker records ordering only. It can never supply a review verdict.
const nativeEditPrefix = "<!-- ai-review-edit:v1 ";
export const nativeReviewBodyHash = (review) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        review.commit_id,
        String(review.state || "").toUpperCase(),
        review.body || "",
      ]),
    )
    .digest("hex");

export const createNativeReviewEditMarker = ({
  agent,
  headSha,
  review,
  observedAt,
  sourceRunId,
}) =>
  `${nativeEditPrefix}${JSON.stringify({
    agent,
    head_sha: headSha,
    review_id: String(review.id),
    body_sha256: nativeReviewBodyHash(review),
    observed_at: new Date(observedAt).toISOString(),
    source_run_id: String(sourceRunId),
  })} -->`;

export const extractNativeReviewEditMarker = (comment) => {
  if (comment?.user?.login !== "github-actions[bot]") return null;
  const body = String(comment.body || "").trim();
  if (!body.startsWith(nativeEditPrefix) || !body.endsWith(" -->")) return null;
  const raw = body.slice(nativeEditPrefix.length, -4);
  try {
    const marker = JSON.parse(raw);
    if (
      JSON.stringify(marker) !== raw ||
      Object.keys(marker).sort().join(",") !==
        "agent,body_sha256,head_sha,observed_at,review_id,source_run_id" ||
      !["codex", "gemini"].includes(marker.agent) ||
      !/^[a-f0-9]{40}$/.test(marker.head_sha) ||
      !/^[a-f0-9]{64}$/.test(marker.body_sha256) ||
      !/^[1-9][0-9]*$/.test(marker.review_id) ||
      !/^[1-9][0-9]*$/.test(marker.source_run_id) ||
      new Date(marker.observed_at).toISOString() !== marker.observed_at
    )
      return null;
    return marker;
  } catch {
    return null;
  }
};

export const nativeReviewTimestamp = (
  review,
  comments = [],
  agent,
  headSha,
) => {
  const original = Date.parse(review.submitted_at || "") || 0;
  if (review.commit_id !== headSha) return original;
  return comments.reduce((latest, comment) => {
    const marker = extractNativeReviewEditMarker(comment);
    if (
      !marker ||
      marker.agent !== agent ||
      marker.head_sha !== headSha ||
      marker.review_id !== String(review.id) ||
      marker.body_sha256 !== nativeReviewBodyHash(review)
    )
      return latest;
    return Math.max(latest, Date.parse(marker.observed_at));
  }, original);
};
