import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";

// Both scripts/ (source) and dist/ (compiled) are directly below the repo root.
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
type Adapter = "codex" | "copilot";
type Operation = "install" | "sync";
interface Options { target: string; adapter?: Adapter; force: boolean }

export function parseArgs(args: string[], operation: Operation): Options {
  let target: string | undefined;
  let adapter: Adapter | undefined;
  let force = false;
  for (const arg of args) {
    if (arg === "--force") force = true;
    else if (arg.startsWith("--adapter=")) {
      const value = arg.slice("--adapter=".length);
      if (adapter || (value !== "codex" && value !== "copilot")) {
        throw new Error(`Unsupported or repeated adapter "${value}". Expected "copilot" or "codex".`);
      }
      adapter = value;
    } else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else if (target) throw new Error("Only one target path is allowed.");
    else target = arg;
  }
  if (!target) throw new Error(`Usage: npm run ${operation}:agents -- /absolute/path/to/repo [--adapter=copilot|codex] [--force]`);
  if (!path.isAbsolute(target)) throw new Error("Target path must be absolute.");
  return { target: path.resolve(target), adapter, force };
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

// Resolve each ancestor and link, including links whose destinations do not exist.
function realDestination(target: string, links = new Set<string>()): string {
  const parent = path.dirname(target);
  if (parent === target) return fs.realpathSync(target);
  const destination = path.join(realDestination(parent, links), path.basename(target));
  const entry = fs.lstatSync(destination, { throwIfNoEntry: false });
  if (!entry?.isSymbolicLink()) return destination;
  if (links.has(destination)) throw new Error(`Symbolic link cycle at: ${destination}`);
  links.add(destination);
  try {
    const link = fs.readlinkSync(destination);
    // Preserve '..' until preceding components have been resolved through links.
    const linkedTarget = path.isAbsolute(link) ? link : `${path.dirname(destination)}${path.sep}${link}`;
    return realDestination(linkedTarget, links);
  } finally {
    links.delete(destination);
  }
}

export function readRoles() {
  return fs.readdirSync(path.join(repoRoot, "agents")).filter(file => file.endsWith(".md")).map(file => {
    const instructions = fs.readFileSync(path.join(repoRoot, "agents", file), "utf8").replaceAll("\r\n", "\n");
    const name = path.basename(file, ".md");
    const description = instructions.match(/^## Purpose\s*\r?\n([^\r\n]+)/m)?.[1].trim();
    if (!description) throw new Error(`Missing purpose for agent "${name}".`);
    return { name, description, instructions };
  });
}

export function renderCodex(role: ReturnType<typeof readRoles>[number]): string {
  const content = [
    `name = ${JSON.stringify(role.name.replaceAll("-", "_"))}`,
    `description = ${JSON.stringify(role.description)}`,
    `sandbox_mode = ${JSON.stringify(role.name === "planner" || role.name === "reviewer" ? "read-only" : "workspace-write")}`,
    "",
    `developer_instructions = ${JSON.stringify(role.instructions)}`,
    "",
  ].join("\n");
  parse(content);
  return content;
}

export function codexFiles(): Map<string, string> {
  return new Map(readRoles().map(role => [`.codex/agents/${role.name}.toml`, renderCodex(role)]));
}

function validateOutputPath(target: string, resolvedTarget: string, file: string): string {
  let ancestor = target;
  for (const segment of file.split(path.sep).slice(0, -1)) {
    ancestor = path.join(ancestor, segment);
    const entry = fs.lstatSync(ancestor, { throwIfNoEntry: false });
    if (!entry) continue;
    const resolvedAncestor = realDestination(ancestor);
    if (!isWithin(resolvedTarget, resolvedAncestor)) {
      throw new Error(`Destination escapes target through a symbolic link: ${file}`);
    }
    if (!fs.lstatSync(resolvedAncestor, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`Destination ancestor is not a directory: ${path.relative(target, ancestor)}`);
    }
  }
  const destination = realDestination(path.join(target, file));
  if (!isWithin(resolvedTarget, destination)) {
    throw new Error(`Destination escapes target through a symbolic link: ${file}`);
  }
  const entry = fs.lstatSync(destination, { throwIfNoEntry: false });
  if (entry && !entry.isFile()) {
    throw new Error(`Destination is not a file: ${file}`);
  }
  return destination;
}

export function deploy(options: Options, operation: Operation): void {
  const { target, force } = options;
  if (isWithin(fs.realpathSync(repoRoot), realDestination(target))) {
    throw new Error("Target path must be outside the engineering-agents repository. Use npm run setup:repo for this checkout.");
  }
  let adapters: Adapter[] = options.adapter ? [options.adapter] : [];
  if (!adapters.length && operation === "sync") {
    if (fs.existsSync(path.join(target, ".codex", "agents"))) adapters.push("codex");
    if (fs.existsSync(path.join(target, ".github", "agents"))) adapters.push("copilot");
  }
  if (!adapters.length) adapters = ["copilot"];

  // Prepare and validate all generated content before writing target files.
  const files = new Map<string, string>();
  const addDirectory = (directory: string) => {
    for (const entry of fs.readdirSync(path.join(repoRoot, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) addDirectory(relative);
      else files.set(relative, fs.readFileSync(path.join(repoRoot, relative), "utf8"));
    }
  };
  addDirectory("agents");
  addDirectory("standards");
  if (operation === "sync") {
    addDirectory("adapters");
    addDirectory("templates");
  }
  files.set("AGENTS.md", fs.readFileSync(path.join(repoRoot, "templates/AGENTS.md"), "utf8"));
  files.set("project-profile.example.yml", fs.readFileSync(path.join(repoRoot, "templates/project-profile.example.yml"), "utf8"));
  for (const adapter of adapters) {
    if (adapter === "codex") {
      const config = fs.readFileSync(path.join(repoRoot, "adapters/codex/config-template.toml"), "utf8");
      parse(config);
      files.set(".codex/config.toml", config);
      for (const [file, content] of codexFiles()) files.set(file, content);
    } else {
      files.set(".github/copilot-instructions.md", fs.readFileSync(path.join(repoRoot, "adapters/copilot/copilot-instructions-template.md"), "utf8"));
      for (const role of readRoles()) {
        const tools = role.name === "planner" || role.name === "reviewer" ? "\ntools:\n  - read\n  - search" : "";
        files.set(`.github/agents/${role.name}.agent.md`, `---\nname: ${role.name}\ndescription: ${JSON.stringify(role.description)}${tools}\n---\n\n${role.instructions}`);
      }
    }
  }

  const resolvedTarget = realDestination(target);
  const claimedDestinations = new Map<string, string>();
  for (const file of files.keys()) {
    const destination = validateOutputPath(target, resolvedTarget, file);
    const destinationKey = process.platform === "win32" ? destination.toLowerCase() : destination;
    const claimedBy = claimedDestinations.get(destinationKey);
    if (claimedBy) {
      throw new Error(`Multiple outputs resolve to the same destination: ${claimedBy} and ${file}`);
    }
    claimedDestinations.set(destinationKey, file);
    // Hard links share file contents even when their paths are inside the target.
    const entry = fs.lstatSync(destination, { throwIfNoEntry: false });
    if (force && file !== ".codex/config.toml" && entry?.isFile() && entry.nlink > 1) {
      throw new Error(`Cannot overwrite hard-linked file: ${file}`);
    }
  }
  let written = 0;
  let skipped = 0;
  for (const [file, content] of files) {
    const destination = realDestination(path.join(target, file));
    // Shared Codex settings belong to the project, even during a forced sync.
    if (fs.existsSync(destination) && (!force || file === ".codex/config.toml")) {
      skipped++;
      continue;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
    written++;
  }
  console.log(`${operation === "install" ? "Installed" : "Synced"} agents into ${target} (${adapters.join(", ")}). Written: ${written}; preserved: ${skipped}.`);
}
