#!/usr/bin/env node
// Generates blocks-cli/src/lib/command-catalog.ts from three sources:
//   1. the command map in blocks-cli/src/index.ts   (which commands exist)
//   2. each command's own source                    (flags, scope, mutating)
//   3. blocks-cli/command-docs.json                 (summary, positional, details)
//
// Only (3) is hand-maintained. Everything else is derived, so help output
// cannot drift from behavior. Run with --check to verify the checked-in
// catalog is current without writing it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const cliSrc = join(root, "blocks-cli", "src");
const catalogPath = join(cliSrc, "lib", "command-catalog.ts");
const docsPath = join(root, "blocks-cli", "command-docs.json");
const check = process.argv.includes("--check");

const GLOBAL_FLAGS = new Set(["json", "api-url", "account", "project", "dry-run", "yes"]);
const FLAG_READERS =
  /(?:stringFlag|booleanFlag|listFlag|integerFlag|optionalIntegerFlag|optionalBooleanFlag|jsonFlag)\s*\(\s*flags\s*,\s*"([^"]+)"/g;
// A handful of commands read a flag straight off the parsed map instead of
// through a helper (`flags["no-blob-type-header"] === true`). Those are real
// flags, so they belong in the catalog too -- and since `blocks` now warns
// about flags the catalog doesn't know, missing one here would warn on valid
// usage.
const FLAG_INDEX_READERS = /\bflags\s*\[\s*"([a-z0-9-]+)"\s*\]/g;

const indexSource = readFileSync(join(cliSrc, "index.ts"), "utf8");

const handlerFiles = new Map();
for (const match of indexSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(\.\/[^"]+)\.js"/g)) {
  const file = join(cliSrc, `${match[2]}.ts`);
  for (const binding of match[1].split(",").map((s) => s.trim()).filter(Boolean)) {
    handlerFiles.set(binding, file);
  }
}

const commandFiles = new Map();
for (const match of indexSource.matchAll(/^\s*"([a-z0-9:-]+)"\s*:\s*(?:\(\)\s*=>\s*)?([A-Za-z0-9_]+)/gm)) {
  const file = handlerFiles.get(match[2]);
  if (file) commandFiles.set(match[1].replaceAll(":", " "), { file, handler: match[2] });
}

// Analysis is scoped to the handler function's own body, not the whole file:
// commands/data/files/object-tree.ts alone exports 23 handlers, and a
// file-wide scan would give every one of them the union of all 23 flag sets.
// Local helper calls are followed within the file, and sibling command files
// are followed for composed commands (data sync, mfa totp enable). Deliberately
// does NOT follow into lib/, whose shared helpers would otherwise make every
// command look project-scoped.
const parsedFiles = new Map();
function parseFile(file) {
  if (parsedFiles.has(file)) return parsedFiles.get(file);
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const functions = new Map();
  const imported = new Map();

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer
          && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
          functions.set(declaration.name.text, declaration.initializer);
        }
      }
    }
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith(".")) continue;
      const target = join(dirname(file), `${specifier.replace(/\.js$/, "")}.ts`);
      const clause = statement.importClause;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) imported.set(element.name.text, target);
      }
    }
  }

  const parsed = { functions, imported, source };
  parsedFiles.set(file, parsed);
  return parsed;
}

function analyze(file, handler, seen = new Set()) {
  const key = `${file}#${handler}`;
  if (seen.has(key) || !existsSync(file)) return { flags: new Set(), traits: new Set() };
  seen.add(key);

  const { functions, imported } = parseFile(file);
  const node = functions.get(handler);
  const flags = new Set();
  const traits = new Set();
  if (!node) return { flags, traits };

  const text = node.getText();
  for (const match of text.matchAll(FLAG_READERS)) flags.add(match[1]);
  for (const match of text.matchAll(FLAG_INDEX_READERS)) flags.add(match[1]);
  if (/jsonBodyFlag/.test(text)) {
    flags.add("body");
    flags.add("file");
  }
  if (/confirmMutation/.test(text)) traits.add("mutating");
  if (/preferImpersonatedProjectAuth/.test(text)) traits.add("prefer");
  if (/impersonatedProjectAuth|selectedProject\(/.test(text)) traits.add("project");
  if (/accountAuth|withAccountMode|getAccountSession/.test(text)) traits.add("account");

  const visit = (current) => {
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
      const callee = current.expression.text;
      const target = functions.has(callee)
        ? { file, handler: callee }
        : imported.has(callee) && imported.get(callee).includes("commands")
          ? { file: imported.get(callee), handler: callee }
          : undefined;
      if (target) {
        const sub = analyze(target.file, target.handler, seen);
        for (const flag of sub.flags) flags.add(flag);
        for (const trait of sub.traits) traits.add(trait);
      }
    }
    current.forEachChild(visit);
  };
  visit(node);

  return { flags, traits };
}

function scopeOf(traits) {
  if (traits.has("prefer")) return "project-or-account";
  if (traits.has("project")) return "project";
  if (traits.has("account")) return "account";
  return "local";
}

const docs = JSON.parse(readFileSync(docsPath, "utf8"));
const problems = [];
const entries = [];

for (const [name, { file, handler }] of commandFiles) {
  const doc = docs[name];
  if (!doc?.summary) {
    problems.push(`${name}: missing a summary in blocks-cli/command-docs.json`);
    continue;
  }

  const { flags, traits } = analyze(file, handler);
  entries.push({
    name,
    family: name.split(" ")[0],
    summary: doc.summary,
    ...(doc.positional ? { positional: doc.positional } : {}),
    ...(doc.details ? { details: doc.details } : {}),
    scope: scopeOf(traits),
    mutating: traits.has("mutating"),
    flags: [...flags].filter((flag) => !GLOBAL_FLAGS.has(flag)).sort()
  });
}

for (const name of Object.keys(docs)) {
  if (!commandFiles.has(name)) problems.push(`${name}: documented in command-docs.json but not a registered command`);
}

if (problems.length > 0) {
  console.error(`${problems.length} command catalog problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

entries.sort((a, b) => a.name.localeCompare(b.name));

const rendered = `// GENERATED FILE -- do not edit by hand.
// Run: node scripts/generate-command-catalog.mjs
// Summaries live in blocks-cli/command-docs.json; everything else is derived
// from src/index.ts and each command's own source.

export type CommandScope = "account" | "local" | "project" | "project-or-account";

export type CommandEntry = {
  details?: string;
  family: string;
  flags: string[];
  mutating: boolean;
  name: string;
  positional?: string;
  scope: CommandScope;
  summary: string;
};

export const commandCatalog: readonly CommandEntry[] = ${JSON.stringify(entries, null, 2)};
`;

if (check) {
  const current = existsSync(catalogPath) ? readFileSync(catalogPath, "utf8") : "";
  if (current.replace(/\r\n/g, "\n") !== rendered) {
    console.error("command-catalog.ts is out of date. Run: node scripts/generate-command-catalog.mjs");
    process.exit(1);
  }
  console.log(`ok: command catalog is current (${entries.length} commands)`);
} else {
  writeFileSync(catalogPath, rendered);
  console.log(`wrote ${catalogPath} (${entries.length} commands)`);
}
