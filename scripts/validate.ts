import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");

const requiredFiles = [
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

console.log("Engineering agents repository structure is valid.");
