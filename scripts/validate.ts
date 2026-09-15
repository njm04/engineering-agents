import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { codexFiles, readRoles } from "./deployment.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");

const requiredFiles = [
  "AGENTS.md",
  "agents/planner.md",
  "agents/implementer.md",
  "agents/quick-implementer.md",
  "agents/debugger.md",
  "agents/reviewer.md",
  "agents/documenter.md",
  "agents/git-integrator.md",
  "standards/common.md",
  "standards/testing.md",
  "standards/security.md",
  "standards/git.md",
  "standards/frontend-react.md",
  "standards/backend-node.md",
  "adapters/copilot/agent-template.md",
  "adapters/copilot/copilot-instructions-template.md",
  "adapters/codex/agent-template.toml",
  "adapters/codex/config-template.toml",
  "templates/AGENTS.md",
  "templates/project-profile.example.yml",
  "scripts/install.ts",
  "scripts/deployment.ts",
  "scripts/setup-repo.ts",
  "tests/deployment.test.mjs",
  "scripts/sync.ts",
  "scripts/validate.ts",
  "package.json",
  "tsconfig.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(repoRoot, file)));

if (missing.length > 0) {
  throw new Error(`Missing required files:\n${missing.map((item) => `- ${item}`).join("\n")}`);
}

const empty = requiredFiles.filter((file) => fs.statSync(path.join(repoRoot, file)).size === 0);

if (empty.length > 0) {
  throw new Error(`Empty required files:\n${empty.map((item) => `- ${item}`).join("\n")}`);
}

for (const instructionFile of ["AGENTS.md", "templates/AGENTS.md"]) {
  const content = fs.readFileSync(path.join(repoRoot, instructionFile), "utf8");
  for (const match of content.matchAll(/`((?:agents|standards)\/[^`*]+\.md)`/g)) {
    if (!fs.existsSync(path.join(repoRoot, match[1]))) {
      throw new Error(`${instructionFile} references missing file: ${match[1]}`);
    }
  }
}

readRoles(); // Validate canonical purpose sections before checking generated files.
parse(fs.readFileSync(path.join(repoRoot, "adapters/codex/agent-template.toml"), "utf8"));
parse(fs.readFileSync(path.join(repoRoot, "adapters/codex/config-template.toml"), "utf8"));
for (const [file, expected] of codexFiles()) {
  const destination = path.join(repoRoot, file);
  if (!fs.existsSync(destination)) throw new Error(`Missing ${file}. Run npm run setup:repo.`);
  const actual = fs.readFileSync(destination, "utf8");
  const agent = parse(actual);
  for (const field of ["name", "description", "developer_instructions"]) {
    if (typeof agent[field] !== "string" || !agent[field].trim()) {
      throw new Error(`${file} is missing required field: ${field}`);
    }
  }
  if (actual.replaceAll("\r\n", "\n") !== expected.replaceAll("\r\n", "\n")) {
    throw new Error(`Stale generated agent: ${file}. Run npm run setup:repo.`);
  }
}

console.log("Repository structure, instruction references, and generated Codex agents are valid.");
