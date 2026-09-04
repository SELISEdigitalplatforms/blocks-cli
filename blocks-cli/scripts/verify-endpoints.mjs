#!/usr/bin/env node
// Endpoint sweep: every route+verb the CLI sends, checked against the actual
// ASP.NET controllers in the sibling service repos (blocks-iam, blocks-os,
// blocks-data, blocks-localization, blocks-logic, blocks-release).
//
// Motivation: the 0.4.x releases fixed two whole classes of bug this check
// would have caught mechanically -- every `release` command 404ing on a stale
// `/api` base segment, and `storage config delete` sending DELETE at an
// endpoint the server declares as POST. Skill prose and CHANGELOG claims are
// written from the server source; when the server moves, this is the tripwire.
//
// Scope: route template + HTTP verb only. Binding (FromQuery vs FromBody),
// DTO field names and replace-vs-patch semantics still need a human read of
// the service -- see AGENTS.md.
//
// Service repos are looked up as siblings of this git repo's parent
// (../../blocks-iam etc.). A missing repo is reported and skipped, so this
// stays runnable from a CLI-only checkout; it only FAILS on a real mismatch
// against a repo that is present. Run: npm run verify:endpoints
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const servicesRoot = join(cliRoot, "..", "..");

const SERVICES = {
  data: "blocks-data",
  iam: "blocks-iam",
  localization: "blocks-localization",
  logic: "blocks-logic",
  os: "blocks-os",
  release: "blocks-release"
};

// Constants the CLI builds paths from; kept in sync with the source of each.
const PATH_CONSTANTS = {
  "${LOCALIZATION_API}": "/localization/v4",
  "${OS_CAPTCHA_API}": "/os/v4/captcha",
  "${OS_SECRETS_API}": "/os/v4/Secrets",
  "${RELEASE_API}": "/release/v4"
};

// ---------------------------------------------------------------- CLI side --
function* walk(dir, filter) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["obj", "bin", "node_modules", "dist"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path, filter);
    else if (filter(path)) yield path;
  }
}

/** Reads the balanced argument list of one blocksRequest(...) call, string-aware. */
function callText(source, openParen) {
  let depth = 0;
  let quote = null;
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openParen, i + 1);
    }
  }
  return source.slice(openParen);
}

function normalizePath(raw) {
  let path = raw;
  for (const [name, value] of Object.entries(PATH_CONSTANTS)) path = path.replaceAll(name, value);
  // Any interpolated segment matches one path segment server-side.
  path = path.replace(/\$\{[^}]*\}/g, "{p}");
  return path;
}

function verbOf(options) {
  const literal = options.match(/method:\s*"(\w+)"/);
  if (literal) return literal[1].toUpperCase();
  if (/method\s*[:\]]/.test(options)) return "ANY"; // conditional method -- check path only
  return /\bbody\s*[:,}]/.test(options) ? "POST" : "GET";
}

function collectCliCalls() {
  const calls = new Map(); // "VERB path" -> [files]
  for (const file of walk(join(cliRoot, "src"), (p) => p.endsWith(".ts"))) {
    const source = readFileSync(file, "utf8");
    const re = /blocksRequest(?:<[^>]*>)?\(\s*(`[^`]*`|"[^"]*")/g;
    let m;
    while ((m = re.exec(source))) {
      const path = normalizePath(m[1].slice(1, -1));
      if (!path.startsWith("/")) continue;
      const options = callText(source, source.indexOf("(", m.index));
      const key = `${verbOf(options)} ${path}`;
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(file.slice(cliRoot.length + 1).replaceAll("\\", "/"));
    }
    // Session-plumbing calls in lib/auth.ts use fetch(new URL(...)) directly.
    for (const raw of source.matchAll(/new URL\(\s*"(\/[a-z]+\/v4\/[^"]+)"/g)) {
      const key = `ANY ${normalizePath(raw[1])}`;
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(file.slice(cliRoot.length + 1).replaceAll("\\", "/"));
    }
  }
  return calls;
}

// ------------------------------------------------------------- server side --
function collectServerRoutes(repoDir) {
  const routes = []; // { verb, segments: ["Mail","Save"] }
  const controllersRoot = join(repoDir, "server");
  if (!existsSync(controllersRoot)) return null;
  for (const file of walk(controllersRoot, (p) => p.endsWith(".cs") && p.replaceAll("\\", "/").includes("/Controllers/"))) {
    const source = readFileSync(file, "utf8");
    // Handles primary constructors ("class XController(IFoo foo) : ControllerBase") too.
    const cls = source.match(/class\s+(\w+?)(?:Controller)?\s*[(:]/);
    const routeAttr = source.match(/\[Route\("([^"]*)"\)\]/);
    if (!cls || !routeAttr) continue;
    const base = routeAttr[1].replace("[controller]", cls[1]);
    // Each [HttpX] attribute is tied to the next public method BY POSITION rather than by
    // one attributes-then-method regex: comments and arbitrary attributes may sit between
    // them (MailController has a commented-out [ProtectedEndPoint] mid-block), and one
    // action may declare several [HttpX] routes (Key/DeleteKeys is POST and DELETE).
    const methods = [...source.matchAll(/public\s+(?:async\s+)?[\w<>?,.[\] ]+?\s+(\w+)\s*\(/g)];
    for (const attr of source.matchAll(/\[Http(Get|Post|Put|Delete|Patch)(?:\("([^"]*)"\))?\]/g)) {
      const method = methods.find((candidate) => candidate.index > attr.index);
      if (!method) continue;
      const [, verb, template] = attr;
      let path = base.replace("[action]", method[1]);
      if (template) path = `${path}/${template}`;
      routes.push({ verb: verb.toUpperCase(), segments: path.split("/").filter(Boolean) });
    }
  }
  return routes;
}

function matches(route, verb, segments) {
  if (verb !== "ANY" && route.verb !== verb) return false;
  if (route.segments.length !== segments.length) return false;
  return segments.every((segment, i) => {
    const server = route.segments[i];
    if (segment.startsWith("{") || server.startsWith("{")) return true;
    return server.toLowerCase() === segment.toLowerCase();
  });
}

// -------------------------------------------------------------------- main --
const serverRoutes = {};
const missingRepos = [];
for (const [service, repo] of Object.entries(SERVICES)) {
  const routes = collectServerRoutes(join(servicesRoot, repo));
  if (routes === null) missingRepos.push(repo);
  else serverRoutes[service] = routes;
}

const failures = [];
let checked = 0;
let skipped = 0;
for (const [key, files] of [...collectCliCalls()].sort()) {
  const [verb, path] = key.split(" ");
  const [, service, version, ...rest] = path.split("/");
  if (version !== "v4") continue;
  const routes = serverRoutes[service];
  if (!routes) { skipped += 1; continue; }
  checked += 1;
  if (!routes.some((route) => matches(route, verb, rest))) {
    failures.push(`${verb} ${path}\n    called from: ${[...new Set(files)].join(", ")}`);
  }
}

if (missingRepos.length > 0) console.log(`skipped repos (not checked out): ${missingRepos.join(", ")}${skipped ? ` -- ${skipped} calls unverified` : ""}`);
if (failures.length > 0) {
  console.error(`MISMATCH: ${failures.length} CLI call(s) have no matching controller route+verb:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`ok: ${checked} CLI route+verb pairs match a controller route in the checked-out service repos`);
