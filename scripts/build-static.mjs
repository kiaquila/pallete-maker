#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "index.html");
const sourceDir = resolve(root, "src");
const harmonyPath = resolve(sourceDir, "scripts", "harmony.mjs");
const distDir = resolve(root, "dist");
const target = resolve(distDir, "index.html");
const targetDir = resolve(distDir, "src");

if (!existsSync(source)) {
  throw new Error("Missing index.html — static build cannot proceed.");
}
if (!existsSync(harmonyPath)) {
  throw new Error(
    "Missing src/scripts/harmony.mjs — static build cannot proceed.",
  );
}

rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });

// ── Inline harmony module ─────────────────────────────────────────────────
// harmony.mjs uses ES module exports so it can be imported by Node.js tests.
// The dist build converts it to an inline <script> block so dist/index.html
// works without an HTTP server (no CORS restriction on file:// for inline JS).

const harmonyContent = readFileSync(harmonyPath, "utf8");

// Strip "export " prefix from top-level const/function declarations.
const harmonyInlined = harmonyContent
  .replace(/^export (const|function) /gm, "$1 ")
  .trim();

let html = readFileSync(source, "utf8");

// Replace the import block with inlined harmony content.
html = html.replace(
  /import\s*\{[\s\S]*?\}\s*from\s*["']\.\/src\/scripts\/harmony\.mjs["'];?\s*\n/,
  harmonyInlined + "\n\n",
);

// Downgrade module script to a plain script so it runs without an HTTP server.
html = html.replace('<script type="module">', "<script>");

writeFileSync(target, html, "utf8");

// Copy src/ to dist/src/ so module sources remain inspectable in dist.
if (existsSync(sourceDir)) {
  cpSync(sourceDir, targetDir, { recursive: true });
}

console.log(`Built static artifact: ${target}`);
