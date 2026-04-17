import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression tests for scripts/ai-review-gate.mjs classification regexes.
 *
 * The gate is an imperative CLI script so we can't import its helpers
 * directly. These tests lock the regex patterns against real-world
 * Codex / connector output variants we have observed on previous PRs,
 * so accidental edits to the regex narrow them and get caught by CI.
 *
 * If the gate's regex changes intentionally, update the patterns
 * below to match the new source-of-truth text from the gate script.
 */

const gateSource = readFileSync(
  resolve(process.cwd(), "scripts/ai-review-gate.mjs"),
  "utf8",
);

// Locked source-of-truth regex literals from ai-review-gate.mjs.
// The grepped patterns below must be present verbatim in the gate
// script so drift is immediately visible in this regression file.
const summaryPrefixPattern = /^Codex Review:/i;
const summaryNoIssuesPattern =
  /did(?:\s+not|\s*n['’]?t)\s+find\s+any\s+major\s+issues/i;
const setupEnvironmentPattern = /create an environment for this repo/i;
const setupAccountPattern = /create a codex account and connect to github/i;

describe("ai-review-gate regex anchors present in source", () => {
  test("Codex summary prefix regex appears in gate", () => {
    assert.ok(gateSource.includes("^Codex Review:"));
  });

  test("Codex 'no major issues' regex appears in gate", () => {
    assert.ok(
      gateSource.includes(
        "did(?:\\s+not|\\s*n['’]?t)\\s+find\\s+any\\s+major\\s+issues",
      ),
    );
  });

  test("Codex setup-environment regex appears in gate", () => {
    assert.ok(gateSource.includes("create an environment for this repo"));
  });
});

describe("Codex summary prefix matches real outputs", () => {
  test("matches 'Codex Review: ... Nice work!'", () => {
    assert.ok(
      summaryPrefixPattern.test(
        "Codex Review: Didn't find any major issues. Nice work!",
      ),
    );
  });

  test("matches 'Codex Review: ... :tada:'", () => {
    assert.ok(
      summaryPrefixPattern.test(
        "Codex Review: Didn't find any major issues. :tada:",
      ),
    );
  });

  test("rejects unrelated connector messages", () => {
    assert.ok(
      !summaryPrefixPattern.test(
        "To use Codex here, create an environment for this repo.",
      ),
    );
  });
});

describe("Codex 'no major issues' phrase matches real outputs", () => {
  test("matches with curly apostrophe 'Didn’t'", () => {
    assert.ok(
      summaryNoIssuesPattern.test("Didn’t find any major issues. Nice work!"),
    );
  });

  test("matches with straight apostrophe Didn't", () => {
    assert.ok(
      summaryNoIssuesPattern.test("Didn't find any major issues. :tada:"),
    );
  });

  test("matches 'did not find any major issues'", () => {
    assert.ok(summaryNoIssuesPattern.test("did not find any major issues"));
  });

  test("rejects unrelated phrasing", () => {
    assert.ok(
      !summaryNoIssuesPattern.test("Found several issues worth reviewing."),
    );
  });
});

describe("Codex setup-reply classifications", () => {
  test("matches 'create an environment for this repo'", () => {
    assert.ok(
      setupEnvironmentPattern.test(
        "To use Codex here, create an environment for this repo.",
      ),
    );
  });

  test("matches 'create a codex account and connect to github'", () => {
    assert.ok(
      setupAccountPattern.test(
        "Please create a Codex account and connect to GitHub to continue.",
      ),
    );
  });
});

describe("skip-mode SHA binding preserved in gate source", () => {
  // Regression anchor for two tightly coupled bugs:
  // 1. 2026-04-17 PR #11: skip-mode filtered by triggerTime → gate
  //    missed pre-dispatch Codex summary comments and timed out 20m.
  // 2. 2026-04-17 PR #12 Codex P1: unfiltered skip-mode accepted a
  //    stale "Didn't find any major issues" from a previous commit →
  //    false-green AI Review on a new push.
  // Correct behaviour: bind skip-mode summary-comment matching to the
  // current head commit's committer/author date, so any summary posted
  // after the head commit was created is authoritative, but prior-push
  // summaries are excluded.
  test("gate fetches head commit to get authoring timestamp", () => {
    assert.ok(
      gateSource.includes("/repos/${owner}/${repo}/commits/${headSha}"),
      "gate must fetch the head commit to obtain a SHA-bound time bound",
    );
  });

  test("gate queries Actions runs by head_sha for push-time binding", () => {
    // Codex P1 #3 on PR #12: commit committer/author date is frozen at
    // authoring time and can be older than prior-head Codex comments
    // after force-push/reset/cherry-pick. Freshness bound must use the
    // push/workflow-run time, which is why gate queries
    // /actions/runs?head_sha={sha} and takes the earliest run.
    assert.ok(
      gateSource.includes(
        "/repos/${owner}/${repo}/actions/runs?head_sha=${headSha}",
      ),
      "gate must fetch earliest Actions run for headSha to obtain push-time",
    );
  });

  test("Actions runs lookup has a permission-safe fallback", () => {
    // Codex P1 #4 on PR #12: the runs lookup needs `actions: read`,
    // which is not default. Gate must try/catch the fetch and fall
    // back to headCommitTime instead of hard-failing so the review
    // path still functions when the scope is dropped.
    assert.ok(
      /try\s*\{[\s\S]*?\/actions\/runs\?head_sha=\$\{headSha\}[\s\S]*?\}\s*catch/.test(
        gateSource,
      ),
      "gate must wrap the /actions/runs fetch in try/catch",
    );
    assert.ok(
      gateSource.includes("falling back to committer date"),
      "gate must log the fallback so permission regressions are visible",
    );
  });

  test("Actions runs lookup walks to the last page for oldest run", () => {
    // Codex P2 #5 on PR #12: GitHub REST /actions/runs is newest-first,
    // so page 1 holds the LATEST runs. A SHA with >100 runs (reruns +
    // manual dispatches accumulate fast) would yield a too-recent
    // `earliestRunTime` from a single-page lookup. Gate must jump to
    // the rel="last" link when pagination exists and take the earliest
    // created_at from THAT page.
    assert.ok(
      gateSource.includes(
        'getPaginationPath(\n        firstResponse.headers.get("link"),\n        "last",\n      )',
      ) ||
        gateSource.includes(
          'getPaginationPath(firstResponse.headers.get("link"), "last")',
        ),
      "gate must extract rel=last for the runs pagination tail",
    );
    assert.ok(
      /lastPagePath[\s\S]*?lastPagePath !== firstPagePath[\s\S]*?apiFetch\(lastPagePath\)/.test(
        gateSource,
      ),
      "gate must actually fetch the last page when it differs from page 1",
    );
  });

  test("skip-mode summary-comment filter uses headFreshnessTime", () => {
    assert.ok(
      gateSource.includes("headFreshnessTime"),
      "gate must bind skip-mode summary filter to the push-time-aware freshness bound",
    );
  });

  test("headFreshnessTime = max(earliestRunTime, headCommitTime)", () => {
    assert.ok(
      /headFreshnessTime\s*=\s*Math\.max\(\s*earliestRunTime[\s\S]*?headCommitTime/.test(
        gateSource,
      ),
      "headFreshnessTime must combine earliest run time and commit metadata",
    );
  });

  test("non-skip branch still uses triggerTime", () => {
    assert.ok(
      /triggerMode === "skip"[\s\S]*?headFreshnessTime[\s\S]*?triggerTime/.test(
        gateSource,
      ),
      "gate must keep triggerTime bound on the non-skip branch",
    );
  });

  test("setup-reply branch also binds skip-mode to headFreshnessTime", () => {
    // Codex P1 #2 + #3 on PR #12: unfiltered skip-mode + committer-date
    // alone both leak stale comments. The fix binds both summary-comment
    // and setup-reply branches to the push-time-aware headFreshnessTime.
    // Regression: count skip-mode → headFreshnessTime clauses — two
    // independent uses.
    const skipModeFreshnessUses = gateSource.match(
      /triggerMode === "skip"[\s\S]*?created_at[\s\S]*?>= headFreshnessTime/g,
    );
    assert.ok(
      skipModeFreshnessUses && skipModeFreshnessUses.length >= 2,
      `gate must bind skip-mode to headFreshnessTime for BOTH summary-comment and connector-reply branches (found ${
        (skipModeFreshnessUses || []).length
      } uses)`,
    );
  });
});
