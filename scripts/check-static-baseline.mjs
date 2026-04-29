#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const headRefIdx = args.indexOf("--head-ref");
const headRef = headRefIdx !== -1 ? args[headRefIdx + 1] : null;

const root = resolve(process.cwd());

const existsAtRef = headRef
  ? (relPath) => {
      try {
        execFileSync("git", ["cat-file", "-e", `${headRef}:${relPath}`], {
          cwd: root,
          stdio: "ignore",
        });
        return true;
      } catch {
        return false;
      }
    }
  : (relPath) => existsSync(resolve(root, relPath));

const readAtRef = headRef
  ? (relPath) =>
      execFileSync("git", ["show", `${headRef}:${relPath}`], {
        cwd: root,
        encoding: "utf8",
      })
  : (relPath) => readFileSync(resolve(root, relPath), "utf8");

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".specify/memory/constitution.md",
  "index.html",
  "favicon.svg",
  "apple-touch-icon.png",
  "package.json",
  "vercel.json",
  ".gemini/config.yaml",
  ".gemini/styleguide.md",
  "docs_pallete_maker/README.md",
  "docs_pallete_maker/adr/README.md",
  "docs_pallete_maker/project-idea.md",
  "docs_pallete_maker/project/frontend/frontend-docs.md",
  "docs_pallete_maker/project/devops/ai-orchestration-protocol.md",
  "docs_pallete_maker/project/devops/ai-pr-workflow.md",
  "docs_pallete_maker/project/devops/delivery-playbook.md",
  "docs_pallete_maker/project/devops/review-contract.md",
  "docs_pallete_maker/project/devops/review-trigger-automation.md",
  "docs_pallete_maker/project/devops/vercel-cd.md",
  "src/scripts/harmony.mjs",
  "src/styles/tailwind.css",
  "src/styles/input.css",
  "tailwind.config.cjs",
  "scripts/check-feature-memory.mjs",
  "scripts/set-implementation-agent.mjs",
  "scripts/new-worktree.mjs",
  "scripts/start-implementation-worker.mjs",
  "scripts/publish-branch.mjs",
  ".github/workflows/ci.yml",
  ".github/workflows/pr-guard.yml",
  ".github/workflows/ai-review.yml",
  ".github/workflows/ai-command-policy.yml",
];

const requiredDirs = ["specs"];

const missing = [
  ...requiredFiles.filter((file) => !existsAtRef(file)),
  ...requiredDirs.filter((dir) => !existsAtRef(dir)),
];

if (missing.length > 0) {
  console.error("Missing required baseline files:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

const html = readAtRef("index.html");
const aiReviewWorkflow = readAtRef(".github/workflows/ai-review.yml");
const prGuardWorkflow = readAtRef(".github/workflows/pr-guard.yml");

// Declarative HTML content assertions.
// Add entries here instead of hardcoding new checks below.
// Each entry: { test: (html) => boolean, message: string }
const htmlAssertions = [
  {
    test: (h) => /<meta[^>]+name=["']viewport["'][^>]*>/i.test(h),
    message: "index.html must include a viewport meta tag.",
  },
  {
    // Matches local or CDN reference — resilient to URL/path changes.
    test: (h) => /html2canvas/i.test(h),
    message: "index.html must reference html2canvas (local script or CDN).",
  },
  {
    // All external scripts must carry an SRI integrity attribute.
    test: (h) => /integrity="sha384-/i.test(h),
    message:
      'External CDN scripts must include an SRI integrity attribute (integrity="sha384-...").',
  },
  {
    test: (h) => /<link[^>]+rel=["']icon["'][^>]+favicon\.svg["']/i.test(h),
    message:
      'index.html must link favicon.svg as the SVG icon (<link rel="icon" type="image/svg+xml" href="favicon.svg">).',
  },
  {
    test: (h) =>
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+apple-touch-icon\.png["']/i.test(
        h,
      ),
    message:
      'index.html must link apple-touch-icon.png (<link rel="apple-touch-icon" href="apple-touch-icon.png">).',
  },
];

const failures = htmlAssertions
  .filter(({ test }) => !test(html))
  .map(({ message }) => message);

// Regex shared by both checkout-ref assertions.
const checkoutWithBlockRe =
  /- name: Checkout\s*\n\s*uses: actions\/checkout@[^\n]+\n\s*with:\n(?<withBlock>(?:\s+[a-zA-Z0-9_-]+:\s*[^\n]+\n)+)/;

// Regex shared by both single-checkout assertions.
const checkoutStepRe = /^[ \t]*-?[ \t]*uses:[ \t]*['"]?actions\/checkout@/gm;

const aiReviewAssertions = [
  {
    test: (workflow) => {
      const checkoutStep = workflow.match(checkoutWithBlockRe);
      return (
        checkoutStep?.groups?.withBlock
          ?.split(/\r?\n/)
          .some((line) =>
            /^ref:\s*\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}\s*$/.test(
              line.trim(),
            ),
          ) ?? false
      );
    },
    message:
      "AI Review checkout must use ref: ${{ github.event.repository.default_branch }} so gate scripts run from trusted main.",
  },
  {
    test: (workflow) => {
      const matches = workflow.match(checkoutStepRe);
      return (matches?.length ?? 0) === 1;
    },
    message:
      "AI Review workflow must contain exactly one actions/checkout step. A second checkout could overwrite gate scripts after the trusted default-branch checkout.",
  },
];

const prGuardAssertions = [
  {
    test: (workflow) => {
      const checkoutStep = workflow.match(checkoutWithBlockRe);
      return (
        checkoutStep?.groups?.withBlock
          ?.split(/\r?\n/)
          .some((line) =>
            /^ref:\s*\$\{\{\s*inputs\.ref\s*\|\|\s*github\.event\.repository\.default_branch\s*\}\}\s*$/.test(
              line.trim(),
            ),
          ) ?? false
      );
    },
    message:
      "PR Guard checkout must use ref: ${{ inputs.ref || github.event.repository.default_branch }} so gate scripts run from trusted main.",
  },
  {
    test: (workflow) => {
      const matches = workflow.match(checkoutStepRe);
      return (matches?.length ?? 0) === 1;
    },
    message:
      "PR Guard workflow must contain exactly one actions/checkout step. A second checkout could overwrite gate scripts after the trusted default-branch checkout.",
  },
];

failures.push(
  ...aiReviewAssertions
    .filter(({ test }) => !test(aiReviewWorkflow))
    .map(({ message }) => message),
  ...prGuardAssertions
    .filter(({ test }) => !test(prGuardWorkflow))
    .map(({ message }) => message),
);

if (failures.length > 0) {
  for (const msg of failures) {
    console.error(msg);
  }
  process.exit(1);
}

console.log("Repository baseline OK.");
