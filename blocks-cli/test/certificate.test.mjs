import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-cert-test-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { base, cwd, configDir };
}

function testAccountProfile(rootTenantId, apiUrl) {
  return {
    apiUrl,
    clientId: "client-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test",
    osUrl: apiUrl,
    rootTenantId,
    scope: "openid profile offline_access",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

async function writeProjectAuth(configDir, apiUrl) {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({
    activeAccount: "alpha",
    accounts: { alpha: { ...testAccountProfile("alpha-root", apiUrl), selectedProject: { tenantId: "target-project" } } }
  }, null, 2)}\n`);
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: { alpha: { projects: { "target-project": { accessToken: "alpha-target-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } } }
  }, null, 2)}\n`);
}

function testEnv(configDir, extra = {}) {
  return { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_OPEN_BROWSER: "0", ...extra };
}

function run(args, { cwd, env }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({ signal, status, stderr: Buffer.concat(stderr).toString("utf8"), stdout: Buffer.concat(stdout).toString("utf8") });
    });
  });
}

/** Minimal multipart parser for assertions (boundary from Content-Type). */
function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || "");
  if (!match) return { fields: {}, files: {} };
  const boundary = match[1] || match[2];
  const text = buffer.toString("binary");
  const parts = text.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  const files = {};
  for (const part of parts) {
    const splitAt = part.indexOf("\r\n\r\n");
    if (splitAt < 0) continue;
    const headers = part.slice(0, splitAt);
    let body = part.slice(splitAt + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    const nameMatch = /name="([^"]+)"/i.exec(headers);
    const fileMatch = /filename="([^"]*)"/i.exec(headers);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (fileMatch) {
      files[name] = { bytes: Buffer.from(body, "binary"), filename: fileMatch[1] };
    } else {
      fields[name] = body;
    }
  }
  return { fields, files };
}

async function startCertServer({ failMessage = null, httpStatus = 200 } = {}) {
  const state = { requests: [] };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const url = new URL(request.url, "http://127.0.0.1");
    const contentType = request.headers["content-type"] || "";
    const multipart = contentType.includes("multipart/form-data") ? parseMultipart(body, contentType) : null;
    state.requests.push({
      contentType,
      method: request.method,
      multipart,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      rawBody: body
    });

    if (url.pathname === "/os/v4/Certificate/UploadCertificate" && request.method === "POST") {
      if (httpStatus !== 200) {
        response.statusCode = httpStatus;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ message: "Unauthorized" }));
        return;
      }
      if (failMessage) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ isSuccess: false, message: failMessage }));
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        downloadUrl: "https://certs.example.test/tenant-cert.pem",
        isSuccess: true
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ message: `unexpected ${request.method} ${url.pathname}` }));
  });

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  return { apiUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)), state };
}

test("certificate upload sends multipart and reports downloadUrl (H2, H5)", async () => {
  const ws = await makeWorkspace();
  const pemPath = join(ws.base, "tenant.pem");
  const pemBytes = Buffer.from("-----BEGIN CERTIFICATE-----\nMIIBtest\n-----END CERTIFICATE-----\n");
  await writeFile(pemPath, pemBytes);
  const server = await startCertServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", pemPath, "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.uploaded, true);
    assert.equal(out.downloadUrl, "https://certs.example.test/tenant-cert.pem");
    assert.equal(out.isThirdParty, false);
    assert.equal(server.state.requests.length, 1);
    const req = server.state.requests[0];
    assert.equal(req.path, "/os/v4/Certificate/UploadCertificate");
    assert.equal(req.query.isThirdParty, "false");
    assert.equal(req.query.providerRef, undefined);
    assert.ok(req.multipart?.files?.certificate, "expected multipart certificate file");
    assert.deepEqual(req.multipart.files.certificate.bytes, pemBytes);
  } finally {
    await server.close();
  }
});

test("certificate upload --third-party --provider-ref forwards query (H3)", async () => {
  const ws = await makeWorkspace();
  const pemPath = join(ws.base, "idp.pem");
  await writeFile(pemPath, "-----BEGIN CERTIFICATE-----\nokta\n-----END CERTIFICATE-----\n");
  const server = await startCertServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", pemPath, "--third-party", "--provider-ref", "okta", "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.isThirdParty, true);
    assert.equal(out.providerRef, "okta");
    assert.equal(out.providerRefIgnoredWhenNotThirdParty, undefined);
    const req = server.state.requests[0];
    assert.equal(req.query.isThirdParty, "true");
    assert.equal(req.query.providerRef, "okta");
  } finally {
    await server.close();
  }
});

test("certificate upload --dry-run does not call upstream (H4)", async () => {
  const ws = await makeWorkspace();
  const pemPath = join(ws.base, "tenant.pem");
  await writeFile(pemPath, "cert-bytes");
  const server = await startCertServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", pemPath, "--dry-run", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.dryRun, true);
    assert.equal(server.state.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("certificate upload missing file fails client-side (C2)", async () => {
  const ws = await makeWorkspace();
  const server = await startCertServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const missing = join(ws.base, "nope.pem");
    const result = await run(
      ["certificate", "upload", "--file", missing, "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 1, result.stderr);
    const out = JSON.parse(result.stderr);
    assert.equal(out.code, "certificate_file_not_found");
    assert.match(out.message, /No file at/);
    assert.equal(server.state.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("certificate upload empty file fails client-side (C3)", async () => {
  const ws = await makeWorkspace();
  const emptyPath = join(ws.base, "empty.pem");
  await writeFile(emptyPath, "");
  const server = await startCertServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", emptyPath, "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 1, result.stderr);
    const out = JSON.parse(result.stderr);
    assert.equal(out.code, "certificate_file_empty");
    assert.equal(server.state.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("certificate upload surfaces upstream isSuccess false (C4)", async () => {
  const ws = await makeWorkspace();
  const pemPath = join(ws.base, "tenant.pem");
  await writeFile(pemPath, "cert");
  const server = await startCertServer({ failMessage: "invalid certificate" });
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", pemPath, "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 1, result.stderr);
    const out = JSON.parse(result.stderr);
    assert.equal(out.code, "certificate_upload_failed");
    assert.equal(out.message, "invalid certificate");
  } finally {
    await server.close();
  }
});

test("certificate upload 403 maps to api_auth_failed (C5)", async () => {
  const ws = await makeWorkspace();
  const pemPath = join(ws.base, "tenant.pem");
  await writeFile(pemPath, "cert");
  // Use 403: a 401 triggers force-refresh first and surfaces account_session_suspended
  // when only a project token is present. Permission denial is 403 from ProtectedEndPoint.
  const server = await startCertServer({ httpStatus: 403 });
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", pemPath, "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 1, result.stderr);
    const out = JSON.parse(result.stderr);
    assert.equal(out.code, "api_auth_failed");
    assert.notEqual(out.code, "certificate_upload_failed");
  } finally {
    await server.close();
  }
});

test("certificate upload provider-ref without --third-party still sends and notes ignore (C6)", async () => {
  const ws = await makeWorkspace();
  const pemPath = join(ws.base, "tenant.pem");
  await writeFile(pemPath, "cert");
  const server = await startCertServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["certificate", "upload", "--file", pemPath, "--provider-ref", "okta", "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.isThirdParty, false);
    assert.equal(out.providerRef, "okta");
    assert.equal(out.providerRefIgnoredWhenNotThirdParty, true);
    const req = server.state.requests[0];
    assert.equal(req.query.isThirdParty, "false");
    assert.equal(req.query.providerRef, "okta");
  } finally {
    await server.close();
  }
});
