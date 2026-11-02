#!/usr/bin/env node
// Command-reference lint for this repo's consumer-facing docs. Run: npm run lint:docs
//
// The CLI README, AGENT_GUIDE and the AI routing guide are read by agents that
// have only the installed `blocks` CLI, so every `blocks ...` invocation they
// show must be a registered command, and the text must be free of the hazards
// below. These checks used to ride along in blocks-skills/lint.mjs; the skills
// (and their own lint) now live in the blocks-skills repo.
// Exit 0 = clean, 1 = problems found (all listed, not just the first).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const registeredCommands = [...readFileSync(join(root, "blocks-cli", "src", "index.ts"), "utf8").matchAll(/^\s*"([a-z0-9:-]+)"\s*:/gm)]
  .map((match) => match[1].replaceAll(":", " "))
  .sort((a, b) => b.length - a.length);

const consumerDocs = [
  join(root, "blocks-cli", "README.md"),
  join(root, "blocks-cli", "AGENT_GUIDE.md"),
  join(root, "blocks-client", "README.md"),
  join(root, "blocks-client", "AGENT_GUIDE.md"),
  join(root, "docs", "AI_ROUTING_GUIDE.md")
];
for (const markdownPath of consumerDocs.filter(existsSync)) {
  checkTextHygiene(markdownPath);
  checkExecutableCommands(markdownPath);
}

function checkTextHygiene(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const rel = relative(root, filePath);

  if (/&#x20;|&nbsp;/i.test(raw)) {
    errors.push(`${rel}: encoded whitespace entity found -- use normal Markdown whitespace`);
  }

  for (const marker of ["â€”", "â€“", "â†’", "Â"]) {
    if (raw.includes(marker)) errors.push(`${rel}: likely UTF-8 mojibake '${marker}'`);
  }

  // The hazard is '--help' after a SUBCOMMAND ('blocks login --help' performs a
  // real login). Global-flag forms like 'blocks --help --json' are safe, as is
  // the dedicated 'blocks help <command>' command, which never reaches a handler.
  for (const match of raw.matchAll(/`(blocks\s+[^`\r\n]*--help[^`\r\n]*)`/g)) {
    const invocation = match[1].replace(/\s+/g, " ").trim();
    const firstToken = invocation.slice("blocks ".length).trimStart().split(" ")[0];
    if (!firstToken.startsWith("--")) {
      errors.push(`${rel}: unsafe subcommand help probe '${invocation}' -- use 'blocks help <command>' or top-level 'blocks --help'`);
    }
  }

  if (/globally selected project/i.test(raw)) {
    errors.push(`${rel}: obsolete global project-selection model -- selection belongs to the resolved account`);
  }
}

function checkExecutableCommands(filePath) {
  if (registeredCommands.length === 0) return;

  const raw = readFileSync(filePath, "utf8");
  const rel = relative(root, filePath);
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
  // Global-flag-only forms ('blocks --help --json') and the help command
  // itself ('blocks help <family>') are valid; help takes a command or family
  // name as its argument, which is not itself an invocation to verify.
  if (commandText.startsWith("--") || commandText === "help" || commandText.startsWith("help ")) return;
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

if (errors.length === 0) {
  console.log(`ok: ${consumerDocs.filter(existsSync).length} docs, no problems found`);
  process.exit(0);
}

console.error(`${errors.length} problem(s) found:`);
for (const error of errors) console.error(`  - ${error}`);
process.exit(1);
