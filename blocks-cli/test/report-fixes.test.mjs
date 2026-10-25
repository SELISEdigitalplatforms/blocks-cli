// Regressions for blocks-site reports 1fc467dd, bacbaebd, 95737817 and 3b86fd8d.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const bin = join(resolve(import.meta.dirname, ".."), "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";
process.env.BLOCKS_NO_LINK_CHECK = "1";

async function workspace(apiUrl) {
  const base = await mkdtemp(join(tmpdir(), "blocks-report-fixes-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await writeFile(join(configDir, "config.json"), JSON.stringify({
    activeAccount: "alpha",
    accounts: {
      alpha: {
        apiUrl, clientId: "client-id", createdAt: "2026-01-01T00:00:00.000Z", oidcUrl: "https://iam.example.test",
        osUrl: apiUrl, rootTenantId: "alpha-root", scope: "openid", updatedAt: "2026-01-01T00:00:00.000Z",
        selectedProject: { tenantId: "target-project" }
      }
    }
  }));
  await writeFile(join(configDir, "tokens.json"), JSON.stringify({
    accounts: { alpha: { projects: { "target-project": { accessToken: "project-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } } }
  }));
  return { cwd, env: { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_STRICT_FLAGS: "1" } };
}

function run(args, { cwd, env }) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const out = [];
    const err = [];
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err.push(c));
    child.on("close", (status) => done({ status, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() }));
  });
}

async function server(route) {
  const requests = [];
  const http = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString();
    const url = new URL(request.url, "http://127.0.0.1");
    const entry = {
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
      authorization: request.headers.authorization,
      blocksKey: request.headers["x-blocks-key"]
    };
    requests.push(entry);
    const [status, body] = route(entry) ?? [500, { error: `unexpected ${entry.method} ${entry.path}` }];
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.setHeader("connection", "close");
    response.end(JSON.stringify(body));
  });
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  return {
    requests,
    url: `http://127.0.0.1:${http.address().port}`,
    close: () => new Promise((r) => { http.closeAllConnections(); http.close(r); })
  };
}

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

test("1fc467dd: organizations list pages from 0 and filters without --search locally", async () => {
  const orgs = [
    { itemId: "o1", name: "A", isDisabled: false },
    { itemId: "o2", name: "B", isDisabled: true },
    { itemId: "o3", name: "C", isDisabled: false, parentOrganizationId: "o1" }
  ];
  const api = await server((r) => {
    if (r.path !== "/iam/v4/iam/organizations") return undefined;
    // IAM: any Filter.* without Filter.Search is a 400.
    const filtered = [...r.search.keys()].some((k) => k.startsWith("Filter."));
    if (filtered && !r.search.get("Filter.Search")) return [400, { title: "One or more validation errors occurred.", errors: { "Filter.Search": ["The Search field is required."] } }];
    const page = Number(r.search.get("Page"));
    const size = Number(r.search.get("PageSize"));
    return [200, { organizations: orgs.slice(page * size, page * size + size), totalCount: orgs.length }];
  });
  try {
    const w = await workspace(api.url);
    const first = await run(["iam", "organizations", "list", ...ctx(api.url)], w);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).organizations.length, 3, "the default page is the first page");
    assert.equal(api.requests[0].search.get("Page"), "0");

    const enabled = await run(["iam", "organizations", "list", "--is-disabled=false", ...ctx(api.url)], w);
    assert.equal(enabled.status, 0, enabled.stderr);
    const out = JSON.parse(enabled.stdout);
    assert.deepEqual(out.organizations.map((o) => o.itemId), ["o1", "o3"]);
    assert.equal(out.filteredBy, "cli");

    const withSearch = await run(["iam", "organizations", "list", "--search", "a", "--ids", "o1,o3", ...ctx(api.url)], w);
    assert.equal(withSearch.status, 0, withSearch.stderr);
    assert.deepEqual(api.requests.at(-1).search.getAll("Filter.Ids"), ["o1", "o3"], "ids bind as a list");
  } finally { await api.close(); }
});

test("1fc467dd: users list sends organizationIds, also for a --body filter's organizationId", async () => {
  const api = await server((r) => r.path === "/iam/v4/iam/users" ? [200, { data: [], totalCount: 0 }] : undefined);
  try {
    const w = await workspace(api.url);
    const flag = await run(["iam", "users", "list", "--organization-id", "org-b", ...ctx(api.url)], w);
    assert.equal(flag.status, 0, flag.stderr);
    assert.deepEqual(api.requests[0].body.filter, { organizationIds: ["org-b"] });

    const body = await run(["iam", "users", "list", "--body", "{\"filter\":{\"organizationId\":\"org-c\",\"name\":\"x\"}}", ...ctx(api.url)], w);
    assert.equal(body.status, 0, body.stderr);
    assert.deepEqual(api.requests[1].body.filter, { name: "x", organizationIds: ["org-c"] });
  } finally { await api.close(); }
});

test("95737817: notification list pages from 0", async () => {
  const api = await server((r) => r.path === "/os/v4/Notification/Gets" ? [200, { configurations: [{ name: "in-app" }], totalCount: 1 }] : undefined);
  try {
    const w = await workspace(api.url);
    const result = await run(["notification", "list", ...ctx(api.url)], w);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(api.requests[0].search.get("Page"), "0");
  } finally { await api.close(); }
});

test("bacbaebd: users activate refuses without --reason and sends it when given", async () => {
  const api = await server((r) => r.path === "/iam/v4/iam/users/activate" ? [200, { isSuccess: true }] : undefined);
  try {
    const w = await workspace(api.url);
    const missing = await run(["iam", "users", "activate", "u1", "--yes", ...ctx(api.url)], w);
    assert.equal(missing.status, 1);
    assert.equal(JSON.parse(missing.stderr).code, "reason_required");
    assert.equal(api.requests.length, 0, "nothing is sent");

    const ok = await run(["iam", "users", "activate", "u1", "--reason", "back from leave", "--yes", ...ctx(api.url)], w);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(api.requests[0].body, { reason: "back from leave", userId: "u1" });
  } finally { await api.close(); }
});

test("95737817: notifier notify resolves the only configuration, fills defaults and sends with the project session", async () => {
  let configurations = [{ name: "in-app" }];
  let notifyStatus = 200;
  const api = await server((r) => {
    if (r.path === "/os/v4/Notification/Gets") return [200, { configurations, totalCount: configurations.length }];
    if (r.path === "/logic/v4/Notifier/Notify") {
      if (notifyStatus !== 200) return [notifyStatus, {}];
      // blocks-logic reads root's configurations for an impersonated caller: only "in-app" exists there.
      return r.body.configurationName === "in-app"
        ? [200, { isSuccess: true }]
        : [200, { isSuccess: false, errors: { ConfigurationName: "no_configuration_exist" } }];
    }
    return undefined;
  });
  try {
    const w = await workspace(api.url);
    const sent = await run(["notifier", "notify", "--user-ids", "u1", "--denormalized-payload", "{\"t\":1}", "--yes", ...ctx(api.url)], w);
    assert.equal(sent.status, 0, sent.stderr);
    const notify = api.requests.find((r) => r.path === "/logic/v4/Notifier/Notify");
    assert.equal(notify.authorization, "Bearer project-token", "a send needs a token since blocks-logic 2026-10-24");
    assert.deepEqual(
      { ...notify.body },
      { connectionId: "server", responseKey: "notification", responseValue: "notification", configurationName: "in-app", denormalizedPayload: "{\"t\":1}", userIds: ["u1"] }
    );

    const unknown = await run(["notifier", "notify", "--user-ids", "u1", "--denormalized-payload", "x", "--configuration-name", "nope", "--yes", ...ctx(api.url)], w);
    assert.equal(unknown.status, 1);
    assert.equal(JSON.parse(unknown.stderr).code, "notification_configuration_not_found");

    // The project has "promo", but the notifier looks in root: say so rather than "not found".
    configurations = [{ name: "in-app" }, { name: "promo" }];
    const rootLookup = await run(["notifier", "notify", "--user-ids", "u1", "--denormalized-payload", "x", "--configuration-name", "promo", "--yes", ...ctx(api.url)], w);
    assert.equal(rootLookup.status, 1);
    assert.equal(JSON.parse(rootLookup.stderr).code, "notify_impersonation_unsupported");

    notifyStatus = 403;
    const refused = await run(["notifier", "notify", "--user-ids", "u1", "--denormalized-payload", "x", "--configuration-name", "in-app", "--yes", ...ctx(api.url)], w);
    assert.equal(refused.status, 1);
    const error = JSON.parse(refused.stderr);
    assert.equal(error.code, "permission_required");
    assert.match(error.message, /blocks-logic::notifier::send/);

    const noTarget = await run(["notifier", "notify", "--denormalized-payload", "x", "--dry-run", ...ctx(api.url)], w);
    assert.equal(JSON.parse(noTarget.stderr).code, "notify_target_required");
  } finally { await api.close(); }
});

test("8daf76c6: enabling OIDC uses the IAM host for account links and warns when its activation page is dead", async () => {
  const api = await server((r) => {
    if (r.path === "/iam/v4/auth/config" && r.method === "GET") return [200, { isOidcEnabled: false, accountActionBaseUrl: "https://app.example.test", accountActivationPath: "activate/" }];
    if (r.path.startsWith("/oidc/activate")) return [404, { error: "not deployed" }];
    return undefined;
  });
  try {
    const w = await workspace(api.url);
    // The account's IAM host is the fake server, so the activation-page check stays local.
    const configPath = join(w.env.BLOCKS_CONFIG_DIR, "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.accounts.alpha.oidcUrl = api.url;
    await writeFile(configPath, JSON.stringify(config));

    const result = await run(["auth", "config", "save", "--oidc-enabled", "--dry-run", ...ctx(api.url)],
      { cwd: w.cwd, env: { ...w.env, BLOCKS_NO_LINK_CHECK: "" } });
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.request.accountActionBaseUrl, api.url, "the preset app domain is replaced by the IAM host");
    assert.equal(plan.request.accountActivationPath, "oidc/activate/");
    assert.match(result.stderr, /oidc\/activate\/ answers 404/);
  } finally { await api.close(); }
});

test("3b86fd8d: email available asks for the project with its session, by POST; users exists posts too", async () => {
  let availableStatus = 200;
  const api = await server((r) => {
    if (r.path === "/iam/v4/iam/email/available" && r.method === "POST") {
      return availableStatus === 200 ? [200, { isAvailable: true }] : [availableStatus, { title: "Forbidden" }];
    }
    if (r.path === "/iam/v4/iam/users/exists" && r.method === "POST") return [200, { userId: null, organizationIds: [] }];
    return undefined;
  });
  try {
    const w = await workspace(api.url);
    const available = await run(["iam", "email", "available", "ops@example.test", ...ctx(api.url)], w);
    assert.equal(available.status, 0, available.stderr);
    assert.deepEqual(JSON.parse(available.stdout), { isAvailable: true });
    const req = api.requests[0];
    assert.deepEqual(req.body, { email: "ops@example.test" });
    assert.equal(req.authorization, "Bearer project-token", "a protected action since IAM 2026-10-14");
    assert.equal(req.search.toString(), "", "the address is not in the URL");

    availableStatus = 403;
    const refused = await run(["iam", "email", "available", "ops@example.test", ...ctx(api.url)], w);
    assert.equal(refused.status, 1);
    const error = JSON.parse(refused.stderr);
    assert.equal(error.code, "permission_required");
    assert.match(error.message, /blocks-iam::iam::email-available/);

    const exists = await run(["iam", "users", "exists", "ops@example.test", ...ctx(api.url)], w);
    assert.equal(exists.status, 0, exists.stderr);
    assert.deepEqual(api.requests.at(-1).body, { email: "ops@example.test" });
    assert.equal(api.requests.at(-1).authorization, "Bearer project-token");
  } finally { await api.close(); }
});
