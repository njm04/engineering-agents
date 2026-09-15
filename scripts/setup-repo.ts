import fs from "node:fs";
import path from "node:path";
import { codexFiles, repoRoot } from "./deployment.js";

// Only regenerate owned role files, preserving root instructions and settings.
for (const [file, content] of codexFiles()) {
  const destination = path.join(repoRoot, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}
console.log("Regenerated this repository's Codex agent definitions.");
