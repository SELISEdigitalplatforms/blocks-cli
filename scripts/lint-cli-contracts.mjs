#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const commandsDir = join(root, "blocks-cli", "src", "commands");
const errors = [];

// Credential-bearing flag names. `url` is matched exactly, never as a suffix:
// a bare `--url` is the pre-signed upload URL, whose query string is itself a
// write credential, while `--website-url` / `--image-url` /
// `--account-action-base-url` are ordinary public addresses that belong in a
// dry-run verbatim.
const SECRET_FLAG_PATTERN = /^(?:(?:.*-)?(?:secret|password|private-key|access-key|connection-string|key-value-pairs)|url)$/;

for (const filePath of sourceFiles(commandsDir)) checkFile(filePath);

if (errors.length > 0) {
  console.error(`${errors.length} CLI contract problem(s) found:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("ok: CLI request and composition contracts hold");

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && extname(entry.name) === ".ts") files.push(path);
  }
  return files;
}

function checkFile(filePath) {
  const source = ts.createSourceFile(filePath, readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true);
  const commandImports = importedCommandBindings(source, filePath);
  const contextVariables = new Set();

  visit(source, (node) => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (
        (ts.isCallExpression(node.initializer)
          && ts.isIdentifier(node.initializer.expression)
          && node.initializer.expression.text === "commandContextArgs")
        || (ts.isArrayLiteralExpression(node.initializer)
          && node.initializer.elements.some((element) => ts.isSpreadElement(element)
            && ts.isCallExpression(element.expression)
            && ts.isPropertyAccessExpression(element.expression.expression)
            && ts.isIdentifier(element.expression.expression.expression)
            && element.expression.expression.expression.text === "argv"))
      )) {
        contextVariables.add(node.name.text);
    }
  });

  visit(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;

    if (node.expression.text === "blocksRequest") checkProjectRequest(source, filePath, node);
    if (node.expression.text === "writeOutput") checkDryRunRedaction(source, filePath, node);
    if (commandImports.has(node.expression.text)) checkComposedCall(source, filePath, node, contextVariables);
  });
}

/**
 * A `--dry-run` that prints a request body carrying a credential must run it
 * through lib/redact.js first. Redaction used to be nine hand-rolled helpers,
 * one per command, so a new secret-bearing command shipped unredacted by
 * default and nothing noticed -- `data files upload-to-url` echoed a whole
 * pre-signed URL, signature included. The shared helper covers the field names;
 * this check covers remembering to call it.
 */
function checkDryRunRedaction(source, filePath, call) {
  const printed = call.arguments[0];
  if (!printed || !ts.isObjectLiteralExpression(printed)) return;

  const isDryRun = printed.properties.some((property) => ts.isPropertyAssignment(property)
    && propertyName(property.name) === "dryRun"
    && property.initializer.kind === ts.SyntaxKind.TrueKeyword);
  if (!isDryRun) return;

  // Only commands that actually read a credential-shaped flag are in scope.
  const fileText = source.getFullText();
  const secretFlags = [...fileText.matchAll(/Flag\s*\(\s*flags\s*,\s*"([a-z0-9-]+)"/g)]
    .map((match) => match[1])
    .filter((flag) => SECRET_FLAG_PATTERN.test(flag));
  if (secretFlags.length === 0) return;

  const printedText = printed.getText();
  if (/\bredact[A-Za-z]*\s*\(/.test(printedText)) return;

  report(
    source,
    filePath,
    call,
    `this dry-run prints a body built from credential-shaped flag(s) (${secretFlags.map((f) => `--${f}`).join(", ")}) `
    + "without redacting it -- wrap it in redactSecrets()/redactUrlSecrets() from lib/redact.js"
  );
}

function checkProjectRequest(source, filePath, call) {
  const options = call.arguments[1];
  if (!options || !ts.isObjectLiteralExpression(options)) return;

  const impersonated = options.properties.some((property) => ts.isPropertyAssignment(property)
    && propertyName(property.name) === "impersonatedProjectAuth"
    && property.initializer.kind === ts.SyntaxKind.TrueKeyword);
  if (!impersonated) return;

  const hasTenant = options.properties.some((property) => propertyName(property.name) === "projectTenantId");
  if (!hasTenant) report(source, filePath, call, "impersonatedProjectAuth requires projectTenantId in the same request options object");
}

function checkComposedCall(source, filePath, call, contextVariables) {
  const args = call.arguments[0];
  if (args && ts.isIdentifier(args) && (args.text === "argv" || contextVariables.has(args.text))) return;
  if (!args || !ts.isArrayLiteralExpression(args)) {
    report(source, filePath, call, `composed command '${call.expression.text}' must receive an argument array with forwarded context`);
    return;
  }

  const forwardsContext = args.elements.some((element) => ts.isSpreadElement(element) && (
    (ts.isIdentifier(element.expression) && contextVariables.has(element.expression.text))
    || (ts.isCallExpression(element.expression)
      && ts.isIdentifier(element.expression.expression)
      && element.expression.expression.text === "commandContextArgs")
  ));
  if (!forwardsContext) {
    report(source, filePath, call, `composed command '${call.expression.text}' must forward commandContextArgs(flags)`);
  }
}

function importedCommandBindings(source, filePath) {
  const bindings = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const target = resolveImport(filePath, statement.moduleSpecifier.text);
    if (!target || target === filePath || !isInside(commandsDir, target)) continue;
    const clause = statement.importClause;
    if (clause?.name) bindings.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) bindings.add(element.name.text);
    }
  }
  return bindings;
}

function resolveImport(filePath, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(filePath), specifier.replace(/\.js$/, ""));
  const candidate = `${base}.ts`;
  return existsSync(candidate) ? candidate : undefined;
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function propertyName(name) {
  if (!name) return undefined;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

function report(source, filePath, node, message) {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  errors.push(`${relative(root, filePath)}:${line + 1}: ${message}`);
}
