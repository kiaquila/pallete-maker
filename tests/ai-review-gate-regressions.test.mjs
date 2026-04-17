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

describe("skip-mode asymmetry preserved in gate source", () => {
  // The gate must treat the issue-comment branch the same as the
  // formal-review branch in skip mode: use `issueComments` directly,
  // not a triggerTime-filtered subset. Regression anchor for the
  // 2026-04-17 bug where PR #11 Codex "no issues" comment was
  // posted before workflow start and missed by the gate.
  test("issue-comment skip-mode branch uses unfiltered comments", () => {
    assert.ok(
      gateSource.includes(
        'triggerMode === "skip"\n        ? issueComments\n        : issueComments.filter(',
      ),
      "gate must contain the skip-mode asymmetry for issueComments",
    );
  });
});
