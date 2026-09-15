import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parse } from "smol-toml";
import { repoRoot } from "../dist/deployment.js";

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "engineering-agents-test-"));
  t.after(() => {
    const resolved = fs.realpathSync(directory);
    const tempRoot = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), tempRoot);
    assert.ok(path.basename(resolved).startsWith("engineering-agents-test-"));
    fs.rmSync(resolved, { recursive: true });
  });
  return directory;
}

function command(script, args, succeeds = true) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "dist", `${script}.js`), ...args], { encoding: "utf8" });
  assert.ifError(result.error);
  if (succeeds) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0, result.stdout);
  return result;
}

function read(target, file) { return fs.readFileSync(path.join(target, file), "utf8"); }
function write(target, file, content) {
  const destination = path.join(target, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function fileLink(t, destination, link) {
  try {
    fs.symlinkSync(destination, link, "file");
    return true;
  } catch (error) {
    if (process.platform !== "win32" || error.code !== "EPERM") throw error;
    t.skip("Windows requires Developer Mode or symlink privileges for file symlinks.");
    return false;
  }
}

for (const adapter of ["codex", "copilot"]) {
  test(`${adapter}: fresh install is complete and preserves canonical instructions`, t => {
    const target = path.join(fixture(t), "target with spaces");
    command("install", [target, `--adapter=${adapter}`]);
    for (const match of read(target, "AGENTS.md").matchAll(/`([^`]+\.md)`/g)) {
      assert.ok(fs.existsSync(path.join(target, match[1])), `Missing ${match[1]}`);
    }
    const canonicalRoles = fs.readdirSync(path.join(repoRoot, "agents")).filter(file => file.endsWith(".md"));
    const activeDirectory = adapter === "codex" ? ".codex/agents" : ".github/agents";
    assert.equal(fs.readdirSync(path.join(target, activeDirectory)).length, canonicalRoles.length);
    const names = new Set();
    for (const file of canonicalRoles) {
      const name = path.basename(file, ".md");
      const source = read(repoRoot, `agents/${file}`);
      const readOnly = name === "planner" || name === "reviewer";
      if (adapter === "codex") {
        const agent = parse(read(target, `${activeDirectory}/${name}.toml`));
        assert.equal(agent.name, name.replaceAll("-", "_"));
        assert.ok(agent.description.length > 0);
        assert.equal(agent.developer_instructions, source.replaceAll("\r\n", "\n"));
        assert.equal(agent.sandbox_mode, readOnly ? "read-only" : "workspace-write");
        assert.equal(agent.model, undefined);
        assert.ok(!names.has(agent.name));
        names.add(agent.name);
      } else {
        const agent = read(target, `${activeDirectory}/${name}.agent.md`);
        assert.ok(agent.startsWith(`---\nname: ${name}\ndescription: `));
        assert.ok(agent.endsWith(source.replaceAll("\r\n", "\n")));
        assert.equal(agent.includes("tools:\n  - read\n  - search"), readOnly);
      }
    }
  });

  test(`${adapter}: repeat install preserves changes; force restores generated files`, t => {
    const target = fixture(t);
    command("install", [target, `--adapter=${adapter}`]);
    const role = adapter === "codex" ? ".codex/agents/planner.toml" : ".github/agents/planner.agent.md";
    const original = read(target, role);
    write(target, role, "custom role");
    write(target, "AGENTS.md", "project instructions");
    command("install", [target, `--adapter=${adapter}`]);
    assert.equal(read(target, role), "custom role");
    assert.equal(read(target, "AGENTS.md"), "project instructions");
    command("install", [target, `--adapter=${adapter}`, "--force"]);
    assert.equal(read(target, role), original);
  });

  test(`${adapter}: sync detects adapter and refreshes stale active files with force`, t => {
    const target = fixture(t);
    command("install", [target, `--adapter=${adapter}`]);
    const role = adapter === "codex" ? ".codex/agents/planner.toml" : ".github/agents/planner.agent.md";
    const original = read(target, role);
    write(target, role, "stale role");
    write(target, "standards/common.md", "stale standards");
    command("sync", [target]);
    assert.equal(read(target, role), "stale role");
    command("sync", [target, "--force"]);
    assert.equal(read(target, role), original);
    assert.equal(read(target, "standards/common.md"), read(repoRoot, "standards/common.md"));
    assert.ok(fs.existsSync(path.join(target, "templates/AGENTS.md")));
    if (adapter === "codex") assert.ok(!fs.existsSync(path.join(target, ".github/agents")));
  });
}

test("Codex installation and forced sync preserve existing project configuration", t => {
  const target = fixture(t);
  const config = 'model_reasoning_effort = "high"\n[agents]\nenabled = false\n';
  write(target, ".codex/config.toml", config);
  for (const script of ["install", "sync"]) {
    command(script, [target, "--adapter=codex", "--force"]);
    assert.equal(read(target, ".codex/config.toml"), config);
    assert.equal(parse(read(target, ".codex/agents/planner.toml")).name, "planner");
  }
});

test("sync updates both detected adapters; explicit selection scopes active output", t => {
  const target = fixture(t);
  command("install", [target, "--adapter=codex"]);
  command("install", [target, "--adapter=copilot"]);
  const codex = ".codex/agents/planner.toml";
  const copilot = ".github/agents/planner.agent.md";
  write(target, codex, "stale");
  write(target, copilot, "stale");
  command("sync", [target, "--adapter=codex", "--force"]);
  assert.notEqual(read(target, codex), "stale");
  assert.equal(read(target, copilot), "stale");
  command("sync", [target, "--force"]);
  assert.notEqual(read(target, copilot), "stale");
});

test("fresh sync defaults to Copilot and creates a complete installation", t => {
  const target = fixture(t);
  command("sync", [target]);
  assert.ok(read(target, ".github/agents/planner.agent.md").includes("name: planner"));
  assert.ok(read(target, "AGENTS.md").includes("standards/common.md"));
});

test("both commands reject malformed arguments and source-repository targets", t => {
  const target = path.join(fixture(t), "unused");
  for (const script of ["install", "sync"]) {
    for (const args of [[], ["relative"], [target, "--adapter=invalid"], [target, "--typo"], [target, target], [repoRoot], [path.join(repoRoot, "nested-target")]]) {
      command(script, args, false);
    }
  }
  assert.ok(!fs.existsSync(target));
});

test("linked output cannot escape the requested target", t => {
  const base = fixture(t);
  const target = path.join(base, "target");
  const outside = path.join(base, "outside");
  fs.mkdirSync(target);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(target, "standards"), process.platform === "win32" ? "junction" : "dir");
  const result = command("install", [target, "--adapter=codex", "--force"], false);
  assert.match(result.stderr, /escapes target/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.ok(!fs.existsSync(path.join(target, "AGENTS.md")));
});

for (const linkType of ["absolute", "relative", "chain", "parent traversal"]) {
  test(`dangling ${linkType} output link cannot create a file outside the target`, t => {
    const base = fixture(t);
    const target = path.join(base, "target");
    const outside = path.join(base, "missing.md");
    fs.mkdirSync(target);
    let destination = linkType === "absolute" ? outside : path.relative(target, outside);
    if (linkType === "parent traversal") {
      const child = path.join(base, "child");
      fs.mkdirSync(child);
      fs.symlinkSync(child, path.join(target, "shortcut"), process.platform === "win32" ? "junction" : "dir");
      destination = `shortcut${path.sep}..${path.sep}missing.md`;
    }
    if (linkType === "chain" && !fileLink(t, destination, path.join(target, "intermediate.md"))) return;
    if (!fileLink(t, linkType === "chain" ? "intermediate.md" : destination, path.join(target, "AGENTS.md"))) return;
    const originalEntries = fs.readdirSync(target).sort();
    assert.equal(fs.existsSync(path.join(target, "AGENTS.md")), false);
    assert.ok(fs.lstatSync(path.join(target, "AGENTS.md")).isSymbolicLink());
    for (const script of ["install", "sync"]) {
      for (const flags of [[], ["--force"]]) {
        const result = command(script, [target, "--adapter=codex", ...flags], false);
        assert.match(result.stderr, /escapes target/);
        assert.equal(fs.existsSync(outside), false);
        assert.deepEqual(fs.readdirSync(target).sort(), originalEntries);
      }
    }
  });
}

test("dangling directory output link cannot create directories outside the target", t => {
  const base = fixture(t);
  const target = path.join(base, "target");
  const outside = path.join(base, "missing-directory");
  fs.mkdirSync(target);
  fs.symlinkSync(outside, path.join(target, "standards"), process.platform === "win32" ? "junction" : "dir");
  assert.equal(fs.existsSync(path.join(target, "standards")), false);
  for (const script of ["install", "sync"]) {
    const result = command(script, [target, "--force"], false);
    assert.match(result.stderr, /escapes target/);
    assert.equal(fs.existsSync(outside), false);
    assert.deepEqual(fs.readdirSync(target), ["standards"]);
  }
});

test("directory link cycles fail before writing output", t => {
  const target = fixture(t);
  const first = path.join(target, "standards");
  const second = path.join(target, "redirect");
  const type = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(second, first, type);
  fs.symlinkSync(first, second, type);
  for (const script of ["install", "sync"]) {
    const result = command(script, [target, "--force"], false);
    assert.match(result.stderr, /Symbolic link cycle/);
    assert.deepEqual(fs.readdirSync(target).sort(), ["redirect", "standards"]);
  }
});

test("directory output links within the target remain supported", t => {
  const target = fixture(t);
  const destination = path.join(target, "shared-standards");
  fs.mkdirSync(destination);
  fs.symlinkSync(destination, path.join(target, "standards"), process.platform === "win32" ? "junction" : "dir");
  for (const script of ["install", "sync"]) {
    command(script, [target, "--force"]);
    assert.equal(read(target, "shared-standards/common.md"), read(repoRoot, "standards/common.md"));
  }
});

test("forced deployment rejects hard-linked output before writing any files", t => {
  const base = fixture(t);
  const target = path.join(base, "target");
  const original = "outside content must survive";
  write(base, "outside.md", original);
  fs.mkdirSync(target);
  fs.linkSync(path.join(base, "outside.md"), path.join(target, "AGENTS.md"));
  assert.equal(fs.statSync(path.join(target, "AGENTS.md")).nlink, 2);
  for (const script of ["install", "sync"]) {
    for (const adapter of ["codex", "copilot"]) {
      const result = command(script, [target, `--adapter=${adapter}`, "--force"], false);
      assert.equal(read(base, "outside.md"), original);
      assert.equal(read(target, "AGENTS.md"), original);
      assert.match(result.stderr, /Cannot overwrite hard-linked file: AGENTS\.md/);
      assert.deepEqual(fs.readdirSync(target), ["AGENTS.md"]);
    }
  }
});

for (const [file, flags] of [["AGENTS.md", []], [".codex/config.toml", ["--force"]]]) {
  test(`deployment preserves hard-linked ${file} when no overwrite is needed`, t => {
    const base = fixture(t);
    const target = path.join(base, "target");
    const original = "project-owned content";
    write(base, "outside.md", original);
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    fs.linkSync(path.join(base, "outside.md"), path.join(target, file));
    for (const script of ["install", "sync"]) {
      command(script, [target, "--adapter=codex", ...flags]);
      assert.equal(read(base, "outside.md"), original);
      assert.equal(read(target, file), original);
      assert.equal(fs.statSync(path.join(target, file)).nlink, 2);
    }
  });
}
