import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");
const args = process.argv.slice(2);
const target = args.find((arg: string) => !arg.startsWith("--"));
const force = args.includes("--force");

if (!target) {
  throw new Error("Usage: npm run sync:agents -- /absolute/path/to/repo [--force]");
}

if (!path.isAbsolute(target)) {
  throw new Error("Target path must be absolute.");
}

const relativeTarget = path.relative(repoRoot, path.resolve(target));
const targetIsInsideRepo =
  relativeTarget === "" ||
  (relativeTarget !== ".." && !relativeTarget.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeTarget));
if (targetIsInsideRepo) {
  throw new Error("Target path must be outside the engineering-agents repository.");
}

const sources = ["agents", "standards", "adapters", "templates"];

const copyRecursive = (from: string, to: string) => {
  const stat = fs.statSync(from);

  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }

  if (fs.existsSync(to) && !force) {
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

for (const source of sources) {
  copyRecursive(path.join(repoRoot, source), path.join(target, source));
}

console.log(`Synced templates into ${target}${force ? " (force)" : ""}.`);
