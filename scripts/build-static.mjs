#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "index.html");
const sourceDir = resolve(root, "src");
const distDir = resolve(root, "dist");
const target = resolve(distDir, "index.html");
const targetDir = resolve(distDir, "src");

if (!existsSync(source)) {
  throw new Error("Missing index.html — static build cannot proceed.");
}

rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });
cpSync(source, target);

if (existsSync(sourceDir)) {
  cpSync(sourceDir, targetDir, { recursive: true });
}

console.log(`Built static artifact: ${target}`);
