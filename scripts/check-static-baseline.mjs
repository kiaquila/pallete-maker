#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".specify/memory/constitution.md",
  "index.html",
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

const missing = requiredFiles.filter(
  (file) => !existsSync(resolve(root, file)),
);

const missingDirs = requiredDirs.filter(
  (dir) => !existsSync(resolve(root, dir)),
);

if (missing.length > 0 || missingDirs.length > 0) {
  console.error("Missing required baseline files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  for (const dir of missingDirs) {
    console.error(`- ${dir}/`);
  }
  process.exit(1);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");

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
];

const failures = htmlAssertions
  .filter(({ test }) => !test(html))
  .map(({ message }) => message);

if (failures.length > 0) {
  for (const msg of failures) {
    console.error(msg);
  }
  process.exit(1);
}

console.log("Repository baseline OK.");
