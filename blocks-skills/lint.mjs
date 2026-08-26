#!/usr/bin/env node
// Consistency lint for blocks-skills/. Run: node blocks-skills/lint.mjs
//
// A skill is consumed by an AI that has ONLY the globally-installed `blocks`
// CLI and a project-local `@seliseblocks/client` -- never this monorepo.
// Checks:
// 1. Every skill directory has a SKILL.md with frontmatter: `name` matches the
//    directory name, `name` <= 64 chars, `description` present, non-empty,
//    on a single physical line, and <= 1024 chars (hard fail) / <= 700 chars
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
const cliIndexPath = join(skillsDir, "..", "blocks-cli", "src", "index.ts");
const registeredCommands = existsSync(cliIndexPath)
  ? [...readFileSync(cliIndexPath, "utf8").matchAll(/^\s*"([a-z0-9:-]+)"\s*:/gm)]
      .map((match) => match[1].replaceAll(":", " "))
      .sort((a, b) => b.length - a.length)
  : [];

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
  for (const markdownPath of markdownFiles(skillPath)) {
    checkLinksInFile(skillName, markdownPath);
    checkEndpointsInFile(markdownPath);
    checkTextHygiene(markdownPath);
    checkExecutableCommands(markdownPath);
  }
}

const consumerDocs = [
  join(skillsDir, "..", "blocks-cli", "README.md"),
  join(skillsDir, "..", "blocks-cli", "AI_USAGE_GUIDE.md"),
  join(skillsDir, "..", "docs", "AI_START_GUIDE.md")
];
for (const markdownPath of consumerDocs.filter(existsSync)) {
  checkTextHygiene(markdownPath);
  checkExecutableCommands(markdownPath);
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files;
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
          `the target skill directory is not guaranteed to be present`
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

function checkTextHygiene(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const rel = relative(skillsDir, filePath);

  if (/&#x20;|&nbsp;/i.test(raw)) {
    errors.push(`${rel}: encoded whitespace entity found -- use normal Markdown whitespace`);
  }

  for (const marker of ["â€”", "â€“", "â†’", "Â"]) {
    if (raw.includes(marker)) errors.push(`${rel}: likely UTF-8 mojibake '${marker}'`);
  }

  for (const match of raw.matchAll(/`(blocks\s+[^`\r\n]*--help[^`\r\n]*)`/g)) {
    const invocation = match[1].replace(/\s+/g, " ").trim();
    if (invocation !== "blocks --help") {
      errors.push(`${rel}: unsafe subcommand help probe '${invocation}' -- use top-level 'blocks --help'`);
    }
  }

  if (/globally selected project/i.test(raw)) {
    errors.push(`${rel}: obsolete global project-selection model -- selection belongs to the resolved account`);
  }
}

function checkExecutableCommands(filePath) {
  if (registeredCommands.length === 0) return;

  const raw = readFileSync(filePath, "utf8");
  const rel = relative(skillsDir, filePath);
  for (const fence of raw.matchAll(/```(?:bash|sh|shell|powershell)?\r?\n([\s\S]*?)```/gi)) {
    for (const sourceLine of fence[1].split(/\r?\n/)) {
      const line = sourceLine.trim().replace(/^\$\s+/, "");
      if (!line.startsWith("blocks ")) continue;
      checkInvocation(rel, line);
    }
  }

  for (const match of raw.matchAll(/`(blocks\s+[^`\r\n]+)`/g)) {
    const lineStart = raw.lastIndexOf("\n", match.index) + 1;
    const lineEnd = raw.indexOf("\n", match.index);
    const containingLine = raw.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (/\b(no|never)\b[^\r\n]*\b(command|equivalent)\b|\bthere is no\b|don't invent/i.test(containingLine)) continue;
    checkInvocation(rel, match[1]);
  }
}

function checkInvocation(rel, line) {
  const invocation = line.split(/\s+#/, 1)[0].replaceAll(":", " ").replace(/\s+/g, " ").trim();
  if (invocation === "blocks --help" || invocation === "blocks --version") return;

  const commandText = invocation.slice("blocks ".length);
  if (commandText.startsWith("<")
    || /(^|\s)<command>(\s|$)/.test(commandText)
    || commandText.includes("*")
    || commandText.includes("...")
    || /[\/|]/.test(commandText)) return;
  const registered = registeredCommands.some(
    (command) => commandText === command
      || commandText.startsWith(`${command} `)
      || command.startsWith(`${commandText} `)
  );
  if (!registered) errors.push(`${rel}: command reference is not registered: '${line}'`);
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length === 0) {
  console.log(`ok: ${skillDirs.length} skills, no problems found${warnings.length ? ` (${warnings.length} warning(s) above)` : ""}`);
  process.exit(0);
}

console.error(`${errors.length} problem(s) found:`);
for (const error of errors) console.error(`  - ${error}`);
process.exit(1);
