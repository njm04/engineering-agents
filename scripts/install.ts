import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");
const args = process.argv.slice(2);
const target = args.find((arg: string) => !arg.startsWith("--"));
const adapter = args.find((arg: string) => arg.startsWith("--adapter="))?.split("=")[1] ?? "copilot";
if (adapter !== "copilot" && adapter !== "codex") {
  throw new Error(`Unsupported adapter "${adapter}". Expected "copilot" or "codex".`);
}
const force = args.includes("--force");

if (!target) {
  throw new Error("Usage: npm run install:agents -- /absolute/path/to/repo [--adapter=copilot|codex] [--force]");
}

if (!path.isAbsolute(target)) {
  throw new Error("Target path must be absolute.");
}

const copy = (from: string, to: string) => {
  if (fs.existsSync(to) && !force) {
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

copy(path.join(repoRoot, "templates", "AGENTS.md"), path.join(target, "AGENTS.md"));
copy(path.join(repoRoot, "templates", "project-profile.example.yml"), path.join(target, "project-profile.example.yml"));

if (adapter === "copilot") {
  copy(
    path.join(repoRoot, "adapters", "copilot", "copilot-instructions-template.md"),
    path.join(target, ".github", "copilot-instructions.md"),
  );
}

if (adapter === "codex") {
  copy(path.join(repoRoot, "adapters", "codex", "config-template.toml"), path.join(target, ".codex", "config.toml"));
}

console.log(`Installed agent templates into ${target} (${adapter}).`);
