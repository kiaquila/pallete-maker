import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function findRepoRoot(start = process.cwd()) {
  let current = resolve(start);
  while (current !== dirname(current)) {
    if (
      existsSync(join(current, ".git")) ||
      existsSync(join(current, ".unicorn-hub/config.json"))
    ) {
      return current;
    }
    current = dirname(current);
  }
  throw new Error(
    `Could not find repository root from ${resolve(start)}. Expected .git or .unicorn-hub/config.json.`,
  );
}

export function readConfig(root = findRepoRoot()) {
  const fallback = {
    docsDir: "docs_pallete_maker",
    specsDir: "specs",
    productPaths: [
      "index.html",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "vercel.json",
      ".htmlvalidate.json",
      ".github/workflows/",
      "scripts/",
      "src/",
      "app/",
      "public/",
      "assets/",
    ],
    requiredChecks: ["baseline-checks", "guard", "AI Review"],
    defaultBaseBranch: "main",
    defaultImplementationAgent: "claude",
    defaultReviewAgent: "codex",
    trustedReviewLogins: [],
    trustedReviewLoginsByAgent: {},
  };
  const configPath = join(root, ".unicorn-hub/config.json");
  if (!existsSync(configPath)) {
    return fallback;
  }
  return { ...fallback, ...readJson(configPath) };
}

export function pathMatches(file, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) return file.startsWith(pattern);
    return file === pattern || file.startsWith(`${pattern}/`);
  });
}
