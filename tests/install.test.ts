import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const runInstall = (target: string, adapter: "copilot" | "codex") => {
  const result = spawnSync("npm", ["run", "install:agents", "--", target, `--adapter=${adapter}`, "--force"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

test("install copies shared canonical directories for copilot and codex", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "install-test-"));
  const copilotTarget = path.join(sandbox, "copilot");
  const codexTarget = path.join(sandbox, "codex");

  runInstall(copilotTarget, "copilot");
  runInstall(codexTarget, "codex");

  for (const target of [copilotTarget, codexTarget]) {
    assert.ok(fs.existsSync(path.join(target, "AGENTS.md")));
    assert.ok(fs.existsSync(path.join(target, "project-profile.example.yml")));
    assert.ok(fs.existsSync(path.join(target, "agents", "planner.md")));
    assert.ok(fs.existsSync(path.join(target, "standards", "common.md")));
  }

  assert.ok(fs.existsSync(path.join(copilotTarget, ".github", "copilot-instructions.md")));
  assert.ok(fs.existsSync(path.join(copilotTarget, ".github", "agents", "planner.agent.md")));
  assert.ok(fs.existsSync(path.join(codexTarget, ".codex", "config.toml")));
  assert.ok(fs.existsSync(path.join(codexTarget, ".codex", "agents", "planner.toml")));
});

test("install rejects targets inside repository", () => {
  const result = spawnSync("npm", ["run", "install:agents", "--", repoRoot, "--adapter=codex", "--force"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Target path must be outside the engineering-agents repository\./);
});
