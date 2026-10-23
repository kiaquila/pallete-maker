import {
  hasCleanCodexState,
  hasCodexStateClockBounds,
  codexNegativeCompletionTime,
  isCodexStateBody,
  codexCodeReviewCompletionTime,
  isCompletedCodexLifecycle,
} from "./codex-review-state.mjs";
import { isKnownCodexHelpFooter } from "./codex-review-help.mjs";
import { createHash } from "node:crypto";

const reviewerBotLogins = new Set([
  "chatgpt-codex-connector[bot]",
  "gemini-code-assist[bot]",
  "claude[bot]",
]);

export const codexReviewerLogins = new Set(["chatgpt-codex-connector[bot]"]);
export const trustedAssociations = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const codexSummaryMarker = "<!-- codex-pull-request-review-summary -->";
const codexSummaryPrefix = /^Codex Review:/i;
const codexReceiptMarker = "<!-- codex-review-receipt:v1 -->";
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

// Native presentation variants observed across the owner's repositories. This
// closed catalog is separate from verdict/SHA parsing; arbitrary prose cannot
// become approval. Public provenance lives in the native-response corpus.
const codexCleanClosings = new Set(
  [
    "",
    ":+1:",
    ":rocket:",
    ":tada:",
    "🚀",
    "🎉",
    "Already looking forward to the next diff.",
    "Another round soon, please!",
    "Bravo.",
    "Breezy!",
    "Can't wait for the next one!",
    "Chef's kiss.",
    "Delightful!",
    "Hooray!",
    "Keep it up!",
    "Keep them coming!",
    "More of your lovely PRs please.",
    "Nice work!",
    "Swish!",
    "What shall we delve into next?",
    "You're on a roll.",
  ].map((text) => text.toLowerCase()),
);

export const classifyCodexSummaryComment = (
  comment,
  headSha,
  { allowUnboundLegacy = true } = {},
) => {
  const pending = {
    outcome: "pending",
    reason:
      "Codex comment lacks unambiguous current-head no-findings evidence.",
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
  const receipt = body.startsWith(codexReceiptMarker);
  const receiptMentions = body.match(/codex-review-receipt/g) || [];
  if (receiptMentions.length !== (receipt ? 1 : 0)) return pending;
  if (receipt) body = body.slice(codexReceiptMarker.length).trim();

  // Ordinary native tasks append this service-owned link after their reply.
  // Remove only one exact trailing link, never arbitrary prose or link text.
  body = body
    .replace(
      /\n\s*\[View task →\]\(https:\/\/chatgpt\.com\/s\/cd_[a-f0-9]{32}\)\s*$/,
      "",
    )
    .trim();

  // Only the known optional GitHub help footer may follow the result.
  const footer = body.indexOf("<details>");
  if (footer >= 0) {
    const help = body.slice(footer);
    if (!isKnownCodexHelpFooter(help)) return pending;
    body = body.slice(0, footer).trim();
  }
  const lines = body.split(/\r?\n/).filter((line) => line.trim());
  const verdict = (lines[0] || "").match(
    /^Codex Review: did(?:\s+not|\s*n['’]?t)\s+find\s+any\s+major\s+issues\.(.*)$/i,
  );
  if (!verdict || !codexCleanClosings.has(verdict[1].trim().toLowerCase()))
    return pending;

  const shaLine = lines[1]?.match(
    /^\*\*Reviewed commit:\*\* `([a-f0-9]{10,40})`$/,
  );
  if (lines.length > (shaLine ? 2 : 1)) return pending;
  if (shaLine) {
    if (
      !/^[a-f0-9]{40}$/.test(headSha || "") ||
      !headSha.startsWith(shaLine[1])
    )
      return pending;
  } else if (receipt || !allowUnboundLegacy) {
    return pending;
  }
  return {
    outcome: "pass",
    reason: "Codex completed review with no major issues.",
    details: [comment.html_url],
    reviewedSha: shaLine?.[1] || null,
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
  issueComments = [],
  pendingOnlyWithoutTimeline = false,
}) => {
  if (!headSha) return null;
  const events = Array.isArray(timelineEvents) ? timelineEvents : [];
  const activationIndex = findLatestHeadActivationIndex(events, headSha);
  const pendingOnly = pendingOnlyWithoutTimeline && events.length === 0;
  if (activationIndex < 0 && !pendingOnly) return null;

  let boundaryIndex = activationIndex;
  for (let index = activationIndex + 1; index < events.length; index += 1) {
    if (isHumanCodexTriggerComment(events[index])) {
      boundaryIndex = index;
    }
  }

  const allComments = [...events, ...issueComments];
  const statePosition = (entry) =>
    events.findLastIndex(
      (event) =>
        isCommentEvent(event) && entry.id != null && event.id === entry.id,
    );
  const stateBoundaryTime = Date.parse(events[boundaryIndex]?.created_at || "");
  const eligibleState = (entry) => {
    if (
      (activationIndex < 0 && !pendingOnly) ||
      !hasCodexStateClockBounds(entry, headSha)
    )
      return false;
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
    if (pendingOnly) return true;
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
            classifyCodexSummaryComment(entry, headSha, {
              allowUnboundLegacy: true,
            }).outcome === "pass"
          ? Date.parse(entry.created_at || "") || 0
          : codexCommentTimestamp(entry);
  const eligibleStaticApproval = (entry) => {
    const createdAt = Date.parse(entry.created_at || "");
    const entryIndex = events.findLastIndex(
      (event) => event === entry || (entry.id != null && event.id === entry.id),
    );
    return (
      Number.isFinite(createdAt) &&
      [activationIndex, boundaryIndex].every((index) => {
        const time = Date.parse(events[index]?.created_at || "");
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

  const boundComments = [...events, ...issueComments]
    .filter((entry) => matchesCodexSummaryComment(entry))
    .filter((entry) => /\*\*Reviewed commit:\*\*/.test(getBody(entry)))
    .filter((entry) => getBody(entry).includes(headSha.slice(0, 10)));
  // Binding is required to pass, never to supersede old evidence. Include all
  // receipt-like responses, including supported receipts for another commit.
  const receiptComments = [...events, ...issueComments].filter(
    (entry) =>
      isCodexBotComment(entry) &&
      getBody(entry).includes("codex-review-receipt"),
  );
  // Preserve Palette's withdrawal semantics even when an edited connector
  // reply loses every recognizable marker. Such replies remain pending.
  const boundaryTime = Date.parse(events[boundaryIndex]?.created_at || "");
  const timelineComments = events.filter(
    (entry, index) =>
      isCodexBotComment(entry) &&
      (index > boundaryIndex ||
        (Number.isFinite(boundaryTime) &&
          codexCommentTimestamp(entry) > boundaryTime)),
  );
  const position = (entry) =>
    events.findLastIndex(
      (event) =>
        isCommentEvent(event) && entry.id != null && event.id === entry.id,
    );
  // Persisted replies can invalidate proof even when timeline retrieval fails.
  // Ignore unedited replies known to precede the current request/activation;
  // edits and replies with no observable position remain conservative signals.
  const persistedReplies = issueComments.filter((entry) => {
    if (!isCodexBotComment(entry)) return false;
    if (
      getBody(entry).startsWith(codexSummaryMarker) &&
      !matchesCodexSummaryComment(entry) &&
      !classifyCodexSetupReply(entry)
    )
      return false;
    return (
      activationIndex < 0 ||
      position(entry) < 0 ||
      position(entry) > boundaryIndex ||
      codexCommentTimestamp(entry) > Date.parse(entry.created_at)
    );
  });
  const candidates = [
    ...timelineComments,
    ...boundComments,
    ...receiptComments,
    ...persistedReplies,
    ...stateComments,
  ];
  const classify = (entry) =>
    (isCodexStateBody(getBody(entry)) && !eligibleState(entry)
      ? {
          outcome: "pending",
          reason:
            "Structured review predates the current request or head activation.",
          details: [entry.html_url],
        }
      : null) ||
    classifyCodexSetupReply(entry) ||
    classifyCodexSummaryComment(entry, headSha, {
      allowUnboundLegacy: timelineComments.some(
        (candidate) =>
          candidate === entry ||
          (entry.id != null && candidate.id === entry.id),
      ),
    });
  // A canonical completed null/null snapshot describes lifecycle, not a
  // verdict or withdrawal. The connector publishes the independent receipt
  // before this final summary edit. Pair only a fresh immutable SHA-bound
  // receipt with the same code completion; null alone never grants approval.
  // Other states (including running/security/unknown text) keep their veto.
  const isEligibleLifecycle = (entry) =>
    eligibleState(entry) && isCompletedCodexLifecycle(getBody(entry), headSha);
  const hasPairedReceipt = (entry) => {
    const created = Date.parse(entry.created_at || "");
    const completed = codexCodeReviewCompletionTime(getBody(entry));
    return candidates.some((receipt) => {
      const published = Date.parse(receipt.created_at || "");
      return (
        !isCodexStateBody(getBody(receipt)) &&
        /\*\*Reviewed commit:\*\*/.test(getBody(receipt)) &&
        classifyCodexSummaryComment(receipt, headSha).outcome === "pass" &&
        eligibleStaticApproval(receipt) &&
        codexCommentTimestamp(receipt) === published &&
        published >= created &&
        published <= completed
      );
    });
  };
  const unpairedLifecycle = candidates
    .filter((entry) => isEligibleLifecycle(entry) && !hasPairedReceipt(entry))
    .filter((entry) => {
      const observed = Math.floor(codexCommentTimestamp(entry) / 1000);
      return !candidates.some(
        (clear) =>
          eligibleState(clear) &&
          hasCleanCodexState(getBody(clear), headSha) &&
          Math.floor(codexCodeReviewCompletionTime(getBody(clear)) / 1000) >
            observed,
      );
    })
    .sort((left, right) => evidenceTime(right) - evidenceTime(left))[0];
  // A late static receipt or formal approval cannot turn an unpaired unknown
  // lifecycle into a verdict. Only its valid pair or newer canonical clear can.
  if (unpairedLifecycle) {
    return {
      comment: unpairedLifecycle,
      classification: {
        outcome: "pending",
        reason:
          "Completed Codex lifecycle lacks an independent in-window verdict.",
        details: [unpairedLifecycle.html_url],
        evidenceTimestamp: evidenceTime(unpairedLifecycle),
        unpairedLifecycle: true,
      },
      reviewState: "PENDING",
      boundaryType:
        boundaryIndex === activationIndex ? "head-activation" : "human-trigger",
    };
  }
  // Timeline outages may expose persisted blockers, never create approval.
  if (pendingOnly) return null;
  const authoritativeCandidates = candidates.filter(
    (entry) => !isEligibleLifecycle(entry) || !hasPairedReceipt(entry),
  );
  const latestTimestamp = Math.max(
    0,
    ...authoritativeCandidates.map(evidenceTime),
  );
  const tied = authoritativeCandidates.filter(
    (entry) => evidenceTime(entry) === latestTimestamp,
  );
  const canOrder = tied.every(
    (entry) =>
      codexCommentTimestamp(entry) === Date.parse(entry.created_at) &&
      position(entry) >= 0,
  );
  // Creation order cannot prove edit order. Resolve the whole timestamp group
  // conservatively, so the result is independent of API order and duplicates.
  const latestCodexComment =
    (tied.some((entry) => isCodexStateBody(getBody(entry)))
      ? tied.find((entry) => classify(entry).outcome !== "pass") || tied.at(-1)
      : canOrder
        ? tied.sort((a, b) => position(a) - position(b)).at(-1)
        : tied.find((entry) => classify(entry).outcome !== "pass") ||
          tied.at(-1)) || null;

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

  const summaryClassification = classify(latestCodexComment);
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
