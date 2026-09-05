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

const relativeTarget = path.relative(repoRoot, path.resolve(target));
const targetIsInsideRepo =
  relativeTarget === "" ||
  (relativeTarget !== ".." && !relativeTarget.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeTarget));
if (targetIsInsideRepo) {
  throw new Error("Target path must be outside the engineering-agents repository.");
}

const copy = (from: string, to: string) => {
  if (fs.existsSync(to) && !force) {
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

const copyDir = (from: string, to: string) => {
  fs.cpSync(from, to, { recursive: true, force });
};

const installCopilotAgents = () => {
  const agentsDir = path.join(repoRoot, "agents");
  for (const entry of fs.readdirSync(agentsDir)) {
    const source = fs.readFileSync(path.join(agentsDir, entry), "utf8");
    const name = path.basename(entry, ".md");
    const description = source.match(/^## Purpose\s*\n(.+)$/m)?.[1];
    if (!description) {
      throw new Error(`Missing purpose for agent "${name}".`);
    }

    const readOnlyTools =
      name === "planner" || name === "reviewer" ? "\ntools:\n  - read\n  - search" : "";
    const destination = path.join(target, ".github", "agents", `${name}.agent.md`);
    if (fs.existsSync(destination) && !force) {
      continue;
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(
      destination,
      `---\nname: ${name}\ndescription: ${JSON.stringify(description)}${readOnlyTools}\n---\n\n${source}`,
    );
  }
};

const installCodexAgents = () => {
  const agentsDir = path.join(repoRoot, "agents");
  for (const entry of fs.readdirSync(agentsDir).filter((name) => name.endsWith(".md"))) {
    const name = path.basename(entry, ".md");
    const destination = path.join(target, ".codex", "agents", entry.replace(/\.md$/, ".toml"));
    if (fs.existsSync(destination) && !force) {
      continue;
    }

    const instructions = fs.readFileSync(path.join(agentsDir, entry), "utf8");
    const sandboxMode = name === "planner" || name === "reviewer" ? "read-only" : "workspace-write";
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `sandbox_mode = ${JSON.stringify(sandboxMode)}\n\ndeveloper_instructions = ${JSON.stringify(instructions)}\n`);
  }
};

copy(path.join(repoRoot, "templates", "AGENTS.md"), path.join(target, "AGENTS.md"));
copy(path.join(repoRoot, "templates", "project-profile.example.yml"), path.join(target, "project-profile.example.yml"));
copyDir(path.join(repoRoot, "agents"), path.join(target, "agents"));
copyDir(path.join(repoRoot, "standards"), path.join(target, "standards"));

if (adapter === "copilot") {
  copy(
    path.join(repoRoot, "adapters", "copilot", "copilot-instructions-template.md"),
    path.join(target, ".github", "copilot-instructions.md"),
  );
  installCopilotAgents();
}

if (adapter === "codex") {
  copy(path.join(repoRoot, "adapters", "codex", "config-template.toml"), path.join(target, ".codex", "config.toml"));
  installCodexAgents();
}

console.log(`Installed agent templates into ${target} (${adapter}).`);
