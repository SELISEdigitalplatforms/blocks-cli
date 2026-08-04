import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillSummary = { description: string; name: string; path: string };
export type SkillDetail = SkillSummary & { content: string };

// Resolves where blocks-skills/*/SKILL.md content lives, in priority order:
// 1. Bundled into this package at build time (see scripts/copy-skills.mjs) --
//    what a published npm install actually ships.
// 2. The monorepo root's blocks-skills/ folder -- covers 'npm run dev' (tsx,
//    no build step) and running straight from a source checkout.
export function resolveSkillsDir(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(moduleDir, "..", "skills"), join(moduleDir, "..", "..", "..", "blocks-skills")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    "No blocks-skills content found. Expected a bundled 'skills' folder next to this package, or a 'blocks-skills' folder at the monorepo root."
  );
}

// Hand-rolled parser for this repo's flat, single-line SKILL.md frontmatter
// (`name: ...` / `description: "..."`) -- no YAML dependency exists in this
// package and none of these fields span multiple lines.
export function parseFrontmatter(raw: string): { body: string; description?: string; name?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { body: raw };

  const [, frontmatter, body] = match;
  const fields: Record<string, string> = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }

    fields[key] = value;
  }

  return { body, description: fields.description, name: fields.name };
}

export async function listSkills(): Promise<SkillSummary[]> {
  const dir = resolveSkillsDir();
  const entries = await readdir(dir, { withFileTypes: true });
  const summaries: SkillSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = join(dir, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;

    const raw = await readFile(skillPath, "utf8");
    const { description, name } = parseFrontmatter(raw);
    summaries.push({ description: description ?? "", name: name ?? entry.name, path: skillPath });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readSkill(name: string): Promise<SkillDetail> {
  const skills = await listSkills();
  const match = skills.find((skill) => skill.name === name);
  if (!match) {
    const available = skills.map((skill) => skill.name).join(", ") || "(none found)";
    throw new Error(`Unknown skill '${name}'. Available skills: ${available}`);
  }

  const content = await readFile(match.path, "utf8");
  return { ...match, content };
}
