#!/usr/bin/env node
// Consistency lint for blocks-skills/. Run: node blocks-skills/lint.mjs
//
// A skill is consumed by an AI that has ONLY the globally-installed `blocks`
// CLI and a project-local `@seliseblocks/client` -- never this monorepo, and
// `blocks skill add` pulls exactly one skill directory at a time. Checks:
// 1. Every skill directory has a SKILL.md with frontmatter: `name` matches the
//    directory name, `name` <= 64 chars, `description` present, non-empty,
//    on a single physical line (blocks-cli's own frontmatter parser --
//    src/lib/skills.ts -- is a hand-rolled line-by-line parser with no YAML
//    dependency; a description that wraps onto a second line silently breaks
//    `blocks skill list`/`show`), and <= 1024 chars (hard fail) / <= 700 chars
//    (warn -- this pack's house style target is ~400-600).
// 2. Relative markdown links (in SKILL.md and any flows/*.md) resolve to a
//    real file.
// 3. No links leave the containing skill's own directory at all -- not into
//    another skill's SKILL.md, not into its flows/, not to a monorepo-only
//    file outside blocks-skills/. A skill may mention another skill BY NAME
//    in plain text, never as a link, since the target isn't guaranteed to be
//    present for a consumer who only pulled this one skill. Links within the
//    same skill's own directory (SKILL.md <-> its own flows/*.md) are fine.
// 4. No raw API endpoint paths (e.g. `/iam/v4/...`, `/os/v4/...`) -- skills
//    describe CLI commands and SDK methods, never the wire protocol behind
//    them; citing a path is exactly the kind of detail that could tempt a
//    raw fetch/curl bypass every skill already forbids.
// Exit 0 = clean, 1 = problems found (all listed, not just the first).
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const skillsDir = dirname(fileURLToPath(import.meta.url));
const errors = [];
const warnings = [];

const DESCRIPTION_HARD_LIMIT = 1024;
const DESCRIPTION_WARN_LIMIT = 700;
const NAME_LIMIT = 64;
const ENDPOINT_PATTERN = /\/(iam|data|os|logic|release|localization)\/v4\/[A-Za-z0-9/{}._-]*/g;

const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const skillName of skillDirs) {
  const skillPath = join(skillsDir, skillName);
  const skillMdPath = join(skillPath, "SKILL.md");

  if (!existsSync(skillMdPath)) {
    errors.push(`${skillName}/: no SKILL.md`);
    continue;
  }

  checkFrontmatter(skillName, skillMdPath);
  checkLinksInFile(skillName, skillMdPath);
  checkEndpointsInFile(skillMdPath);

  const flowsDir = join(skillPath, "flows");
  if (existsSync(flowsDir) && statSync(flowsDir).isDirectory()) {
    for (const entry of readdirSync(flowsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const flowPath = join(flowsDir, entry.name);
        checkLinksInFile(skillName, flowPath);
        checkEndpointsInFile(flowPath);
      }
    }
  }
}

function checkFrontmatter(skillName, skillMdPath) {
  const raw = readFileSync(skillMdPath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const rel = relative(skillsDir, skillMdPath);

  if (!match) {
    errors.push(`${rel}: missing frontmatter (expected a leading --- ... --- block)`);
    return;
  }

  const lines = match[1].split(/\r?\n/);
  const nameLine = lines.find((line) => line.startsWith("name:"));
  const descLine = lines.find((line) => line.startsWith("description:"));

  if (!nameLine) {
    errors.push(`${rel}: frontmatter has no 'name' field`);
  } else {
    const name = nameLine.slice("name:".length).trim();
    if (name !== skillName) {
      errors.push(`${rel}: name '${name}' does not match directory name '${skillName}'`);
    }
    if (name.length > NAME_LIMIT) {
      errors.push(`${rel}: name is ${name.length} chars, over the ${NAME_LIMIT}-char limit`);
    }
  }

  if (!descLine) {
    errors.push(`${rel}: frontmatter has no 'description' field`);
    return;
  }

  const singleLineMatch = descLine.match(/^description:\s*"(.*)"\s*$/);
  if (!singleLineMatch) {
    errors.push(
      `${rel}: 'description' must be a double-quoted string on a single physical line ` +
        `(blocks-cli's frontmatter parser reads it line-by-line -- a wrapped description silently truncates)`
    );
    return;
  }

  const description = singleLineMatch[1];
  if (description.length === 0) {
    errors.push(`${rel}: 'description' is empty`);
  } else if (description.length > DESCRIPTION_HARD_LIMIT) {
    errors.push(`${rel}: description is ${description.length} chars, over the ${DESCRIPTION_HARD_LIMIT}-char hard limit`);
  } else if (description.length > DESCRIPTION_WARN_LIMIT) {
    warnings.push(`${rel}: description is ${description.length} chars, over the ${DESCRIPTION_WARN_LIMIT}-char house-style target (aim for ~400-600)`);
  }
}

function checkLinksInFile(skillName, filePath) {
  const raw = readFileSync(filePath, "utf8");
  const rel = relative(skillsDir, filePath);
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  const fileDir = dirname(filePath);

  for (const match of raw.matchAll(linkPattern)) {
    const target = match[1].trim();
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith("#")) continue; // external URL or in-page anchor

    const [pathPart] = target.split("#");
    if (!pathPart) continue;

    const resolved = join(fileDir, pathPart);
    if (!existsSync(resolved)) {
      errors.push(`${rel}: broken link to '${pathPart}' (resolved: ${relative(skillsDir, resolved)})`);
      continue;
    }

    const resolvedRelToSkills = relative(skillsDir, resolved).split(/[\\/]/);
    const targetSkill = resolvedRelToSkills[0];
    if (targetSkill !== skillName) {
      errors.push(
        `${rel}: link leaves this skill's own directory ('${pathPart}') -- ` +
          `mention other skills by name in plain text instead, never a link, since ` +
          `'blocks skill add' only copies one skill directory at a time and the target isn't guaranteed to be present`
      );
    }
  }
}

function checkEndpointsInFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const rel = relative(skillsDir, filePath);

  for (const match of raw.matchAll(ENDPOINT_PATTERN)) {
    errors.push(`${rel}: raw API endpoint path '${match[0]}' -- describe the CLI command/SDK method instead, never the wire path`);
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length === 0) {
  console.log(`ok: ${skillDirs.length} skills, no problems found${warnings.length ? ` (${warnings.length} warning(s) above)` : ""}`);
  process.exit(0);
}

console.error(`${errors.length} problem(s) found:`);
for (const error of errors) console.error(`  - ${error}`);
process.exit(1);
