import assert from "node:assert/strict";
import test from "node:test";
import { createBlocksClient } from "../dist/index.js";

test("creates a framework-neutral client", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com/",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ url, headers: Object.fromEntries(init.headers) });
    },
    xBlocksKey: "tenant-1"
  });

  const response = await blocks.http.request("/iam/v4/iam/me", { auth: false });
  assert.equal(response.url, "https://api.seliseblocks.com/iam/v4/iam/me");
  assert.equal(response.headers["x-blocks-key"], "tenant-1");
  assert.equal(calls.length, 1);
});

test("uses caller-owned access token with x-blocks-key", async () => {
  const blocks = createBlocksClient({
    accessToken: () => "user-token",
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => jsonResponse({ url, headers: Object.fromEntries(init.headers) }),
    xBlocksKey: "tenant-1"
  });

  const response = await blocks.iam.me();
  assert.equal(response.headers.authorization, "Bearer user-token");
  assert.equal(response.headers["x-blocks-key"], "tenant-1");
});

test("localization t returns fallback before dictionary load", () => {
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    xBlocksKey: "tenant-1"
  });

  assert.equal(blocks.localization.t("missing.key", "Fallback"), "Fallback");
});

test("auth separates idp, AuthController, and oidc token endpoint flows", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/idp/initiate")) return jsonResponse({ redirect_uri: "https://provider.example/authorize" });
      return jsonResponse({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, token_type: "Bearer" });
    },
    oidc: {
      clientId: "browser-client",
      redirectUri: "https://app.example/login/callback",
      url: "https://api.seliseblocks.com"
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.auth.idp.initiate();
  await blocks.auth.login({ username: "user@example.com", password: "pw" });
  await blocks.auth.oidc.refreshToken({ refreshToken: "refresh-from-app" });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/iam/v4/idp/initiate?clientId=browser-client&redirectUri=https%3A%2F%2Fapp.example%2Flogin%2Fcallback");
  assert.equal(calls[1].url, "https://api.seliseblocks.com/iam/v4/auth/login");
  assert.deepEqual(JSON.parse(calls[1].init.body), { username: "user@example.com", password: "pw" });
  assert.equal(calls[2].url, "https://api.seliseblocks.com/iam/v4/oidc/token");
  assert.equal(calls[2].init.body.toString(), "client_id=browser-client&grant_type=refresh_token&refresh_token=refresh-from-app");
  assert.equal(Object.fromEntries(calls[2].init.headers)["x-blocks-key"], "tenant-1");
});

test("oidc refresh sends caller provided client id without full oidc config", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ access_token: "access-1" });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.auth.oidc.refreshToken({
    clientId: "browser-client",
    refreshToken: "refresh-from-app"
  });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/iam/v4/oidc/token");
  assert.equal(calls[0].init.body.toString(), "client_id=browser-client&grant_type=refresh_token&refresh_token=refresh-from-app");
});

test("auth exposes remaining AuthController endpoints as pass-through wrappers", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ received: url, method: init?.method ?? "GET" }, 400);
    },
    xBlocksKey: "tenant-1"
  });

  const response = await blocks.auth.identityProviders.updateStatus("idp-1", { isActive: false });
  await blocks.auth.config.get();
  await blocks.auth.userCodes.generate({ clientId: "client-1" });
  await blocks.auth.clientCredentials.delete("cred-1");

  assert.deepEqual(response, {
    method: "PATCH",
    received: "https://api.seliseblocks.com/iam/v4/auth/identity-providers/idp-1/status"
  });
  assert.equal(calls[1].url, "https://api.seliseblocks.com/iam/v4/auth/config");
  assert.equal(calls[2].url, "https://api.seliseblocks.com/iam/v4/auth/user-codes");
  assert.deepEqual(JSON.parse(calls[2].init.body), { clientId: "client-1" });
  assert.equal(calls[3].url, "https://api.seliseblocks.com/iam/v4/auth/client-credentials/cred-1");
  assert.equal(calls[3].init.method, "DELETE");
});

test("iam maps controller sections without ProjectKey query", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.iam.me();
  await blocks.iam.users.list({ pageNo: 1, pageSize: 20 });
  await blocks.iam.organizations.my();
  await blocks.iam.resources.features({ search: "dashboard" });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/iam/v4/iam/me");
  assert.equal(calls[1].url, "https://api.seliseblocks.com/iam/v4/iam/users");
  assert.deepEqual(JSON.parse(calls[1].init.body), { pageNo: 1, pageSize: 20 });
  assert.equal(calls[2].url, "https://api.seliseblocks.com/iam/v4/iam/organizations/my");
  assert.equal(calls[3].url, "https://api.seliseblocks.com/iam/v4/iam/resource/features?search=dashboard");
  assert.equal(Object.fromEntries(calls[0].init.headers)["x-blocks-key"], "tenant-1");
});

test("mfa exposes self-service endpoints plus admin config save", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    accessToken: () => "user-token",
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.mfa.config();
  await blocks.mfa.saveConfig({ enableMfa: true, mfaRequiredRoles: ["admin"], userMfaType: [1] });
  await blocks.mfa.generate({ mfaType: 1 });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/iam/v4/mfa/config");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, "https://api.seliseblocks.com/iam/v4/mfa/config");
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body), { enableMfa: true, mfaRequiredRoles: ["admin"], userMfaType: [1] });
  assert.equal(calls[2].url, "https://api.seliseblocks.com/iam/v4/mfa/generate");
});

test("localization uses x-blocks-key header for runtime endpoints", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    accessToken: () => "user-token",
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ HELLO: "Hello" });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.localization.languages();
  await blocks.localization.modules();
  await blocks.localization.translations("common", "en-US");
  await blocks.localization.languagesForCurrentTenant();
  await blocks.localization.modulesForCurrentTenant();
  await blocks.localization.cloudTranslations("private", "en-US");
  await blocks.localization.keysByNames({
    keyNames: ["HELLO"],
    moduleId: "module-1",
    projectKey: "legacy-project-key"
  });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/localization/v4/Language/Gets");
  assert.equal(calls[1].url, "https://api.seliseblocks.com/localization/v4/Module/Gets");
  assert.equal(calls[2].url, "https://api.seliseblocks.com/localization/v4/Key/GetUilmFile?Language=en-US&ModuleName=common");
  assert.equal(calls[3].url, "https://api.seliseblocks.com/localization/v4/Language/GetLanguagesForCurrentTenant");
  assert.equal(calls[4].url, "https://api.seliseblocks.com/localization/v4/Module/GetModulesForCurrentTenant");
  assert.equal(calls[5].url, "https://api.seliseblocks.com/localization/v4/Key/GetCloudUilmFile?Language=en-US&ModuleName=private");
  assert.equal(calls[6].url, "https://api.seliseblocks.com/localization/v4/Key/GetsByKeyNames");
  assert.equal(Object.fromEntries(calls[0].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(Object.fromEntries(calls[1].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(Object.fromEntries(calls[2].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(Object.fromEntries(calls[3].init.headers).authorization, "Bearer user-token");
  assert.equal(Object.fromEntries(calls[4].init.headers).authorization, "Bearer user-token");
  assert.equal(Object.fromEntries(calls[5].init.headers).authorization, "Bearer user-token");
  assert.deepEqual(JSON.parse(calls[6].init.body), {
    keyNames: ["HELLO"],
    moduleId: "module-1"
  });
  assert.equal(calls.some((call) => call.url.includes("/localization/v4/api/")), false);
  assert.equal(blocks.localization.t("HELLO"), "Hello");
});

test("data exposes schema info and current storage helper endpoints", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.data.schemas.list({ keyword: "student", pageSize: 10 });
  await blocks.data.schemas.aggregation({ schemaType: 1 });
  await blocks.data.schemas.getById("schema-1");
  await blocks.data.schemas.info();
  await blocks.data.schemas.infoByName("Student");
  await blocks.data.files.presignedUploadUrl({ fileName: "a.txt" });
  await blocks.data.files.info({ page: 1, pageSize: 10, projectKey: "legacy-project-key" });
  await blocks.data.files.delete({ fileId: "file-1", permanent: false, projectKey: "legacy-project-key" });
  await blocks.data.files.updateAdditionalInfo({
    additionalProperties: { status: "ready" },
    itemId: "file-1",
    ProjectKey: "legacy-project-key"
  });
  await blocks.data.directories.create({ name: "Docs", parentDirectoryId: "root" });
  await blocks.data.directories.get("folder-1");
  await blocks.data.objects.list({ limit: 20, parentDirectoryId: "folder-1", type: "file" });
  await blocks.data.objects.share({
    permission: "View",
    principalId: "role-1",
    principalType: "Role",
    resourceId: "folder-1",
    resourceType: "Directory"
  });
  await blocks.data.validations.list({ schemaId: "schema-1", fieldName: "email", projectKey: "legacy-project-key" });
  await blocks.data.validations.getById("validation-1");
  await blocks.data.validations.bySchemaId("schema-1");
  await blocks.data.validations.bySchemaAndField({ schemaId: "schema-1", fieldName: "email" });
  await blocks.data.utilities.generateRegex({ description: "email" });
  await blocks.data.utilities.mockData();
  await blocks.data.graphql({ query: "{ students { items { itemId } } }", variables: { take: 10 } });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/data/v4/schemas?Keyword=student&PageNo=1&PageSize=10");
  assert.equal(calls[1].url, "https://api.seliseblocks.com/data/v4/schemas/aggregation?PageNo=1&PageSize=100&SchemaType=1");
  assert.equal(calls[2].url, "https://api.seliseblocks.com/data/v4/schemas/get-by-id?id=schema-1");
  assert.equal(calls[3].url, "https://api.seliseblocks.com/data/v4/schemas/info");
  assert.equal(calls[4].url, "https://api.seliseblocks.com/data/v4/schemas/info-by-name?schemaName=Student");
  assert.equal(calls[5].url, "https://api.seliseblocks.com/data/v4/files/get-pre-signed-url-for-upload");
  assert.equal(calls[5].init.method, "POST");
  assert.equal(Object.fromEntries(calls[0].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(Object.fromEntries(calls[1].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(Object.fromEntries(calls[2].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(Object.fromEntries(calls[3].init.headers)["x-blocks-key"], "tenant-1");
  assert.deepEqual(JSON.parse(calls[5].init.body), { Name: "a.txt" });
  assert.equal(calls[6].url, "https://api.seliseblocks.com/data/v4/files/get-files-info");
  assert.deepEqual(JSON.parse(calls[6].init.body), { page: 1, pageSize: 10 });
  assert.equal(calls[7].url, "https://api.seliseblocks.com/data/v4/files/delete-file");
  assert.deepEqual(JSON.parse(calls[7].init.body), { fileId: "file-1", permanent: false });
  assert.equal(calls[8].url, "https://api.seliseblocks.com/data/v4/files/update-file-additional-info");
  assert.deepEqual(JSON.parse(calls[8].init.body), {
    additionalProperties: { status: "ready" },
    itemId: "file-1"
  });
  assert.equal(calls[9].url, "https://api.seliseblocks.com/data/v4/directory/create-directory");
  assert.deepEqual(JSON.parse(calls[9].init.body), { name: "Docs", parentDirectoryId: "root" });
  assert.equal(calls[10].url, "https://api.seliseblocks.com/data/v4/directory/get-directory?directoryId=folder-1");
  assert.equal(calls[11].url, "https://api.seliseblocks.com/data/v4/objects/get-objects?limit=20&parentDirectoryId=folder-1&type=file");
  assert.equal(calls[12].url, "https://api.seliseblocks.com/data/v4/objects/share-object");
  assert.deepEqual(JSON.parse(calls[12].init.body), {
    permission: "View",
    principalId: "role-1",
    principalType: "Role",
    resourceId: "folder-1",
    resourceType: "Directory"
  });
  assert.equal(calls[13].url, "https://api.seliseblocks.com/data/v4/data-validations?FieldName=email&PageNo=1&PageSize=100&SchemaId=schema-1");
  assert.equal(calls[14].url, "https://api.seliseblocks.com/data/v4/data-validations/get-by-id?id=validation-1");
  assert.equal(calls[15].url, "https://api.seliseblocks.com/data/v4/data-validations/by-schema-id?schemaId=schema-1");
  assert.equal(calls[16].url, "https://api.seliseblocks.com/data/v4/data-validations/by-schema-and-field?schemaId=schema-1&fieldName=email");
  assert.equal(calls[17].url, "https://api.seliseblocks.com/data/v4/regex/generate-regex");
  assert.deepEqual(JSON.parse(calls[17].init.body), { description: "email" });
  assert.equal(calls[18].url, "https://api.seliseblocks.com/data/v4/mock-data");
  assert.equal(calls[19].url, "https://api.seliseblocks.com/data/v4/gateway");
  assert.equal(calls.some((call) => call.url.includes("/data/v4/api/")), false);
  assert.deepEqual(JSON.parse(calls[19].init.body), {
    query: "{ students { items { itemId } } }",
    variables: { take: 10 }
  });
});

test("storage object-tree helpers cover file, directory, trash, and access operations", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.data.files.versions({ fileId: "file-1", limit: 25 });
  await blocks.data.files.createVersion({ fileId: "file-1" });
  await blocks.data.files.copy({ copyAccessPolicies: true, fileId: "file-1", targetDirectoryId: "dir-2" });
  await blocks.data.files.move({ fileId: "file-1", targetDirectoryId: "dir-2" });
  await blocks.data.files.rename({ fileId: "file-1", name: "renamed.pdf" });
  await blocks.data.directories.update({ directoryId: "dir-1", name: "Renamed" });
  await blocks.data.directories.delete({ directoryId: "dir-1", permanent: false });
  await blocks.data.directories.move({ directoryId: "dir-1", targetDirectoryId: "dir-2" });
  await blocks.data.objects.search({ directoryId: "dir-1", query: "invoice" });
  await blocks.data.objects.trash({ limit: 10, type: "file" });
  await blocks.data.objects.shared({ limit: 10 });
  await blocks.data.objects.restore({ resourceId: "file-1" });
  await blocks.data.objects.deleteFromTrash({ resourceId: "file-1" });
  await blocks.data.objects.accessPolicies("dir-1");
  await blocks.data.objects.grantAccess({
    effect: "Allow", permission: "Edit", principalId: "role-1", principalType: "Role",
    resourceId: "dir-1", resourceType: "Directory"
  });
  await blocks.data.objects.updateAccess({
    effect: "Deny", permission: "Delete", policyItemId: "policy-1", principalId: "role-1",
    principalType: "Role", resourceId: "dir-1", resourceType: "Directory"
  });
  await blocks.data.objects.revokeAccess({ policyItemId: "policy-1", resourceId: "dir-1" });
  await blocks.data.objects.resolveAccess("dir-1");
  await blocks.data.objects.toggleInheritance({ inheritsParentAccess: false, resourceId: "dir-1" });

  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/data/v4/files/get-file-versions",
    "/data/v4/files/create-file-version",
    "/data/v4/files/copy-file",
    "/data/v4/files/move-file",
    "/data/v4/files/rename-file",
    "/data/v4/directory/update-directory",
    "/data/v4/directory/delete-directory",
    "/data/v4/directory/move-directory",
    "/data/v4/objects/search-objects",
    "/data/v4/objects/get-trash",
    "/data/v4/objects/get-shared-objects",
    "/data/v4/objects/restore-from-trash",
    "/data/v4/objects/delete-from-trash",
    "/data/v4/objects/get-access-policies",
    "/data/v4/objects/grant-access",
    "/data/v4/objects/update-access-policy",
    "/data/v4/objects/revoke-access-policy",
    "/data/v4/objects/resolve-access",
    "/data/v4/objects/toggle-inheritance"
  ]);
  assert.deepEqual(JSON.parse(calls[6].init.body), { directoryId: "dir-1", permanent: false });
  assert.equal(calls[8].url, "https://api.seliseblocks.com/data/v4/objects/search-objects?directoryId=dir-1&query=invoice");
});

test("data collection helpers use the GraphQL gateway runtime", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  const products = blocks.data.collection("Product", { fields: ["name", "price"] });
  await products.list({ filter: { status: "Active" }, pageNo: 2, pageSize: 5 });
  await products.get("product-1");
  await products.create({ name: "Laptop", price: 1200 });
  await products.update("product-1", { price: 1100 });
  await products.delete("product-1", { hardDelete: true });

  assert.deepEqual(calls.map((call) => call.url), [
    "https://api.seliseblocks.com/data/v4/gateway",
    "https://api.seliseblocks.com/data/v4/gateway",
    "https://api.seliseblocks.com/data/v4/gateway",
    "https://api.seliseblocks.com/data/v4/gateway",
    "https://api.seliseblocks.com/data/v4/gateway"
  ]);
  assert.deepEqual(calls.map((call) => call.init.method), ["POST", "POST", "POST", "POST", "POST"]);

  const [listBody, getBody, createBody, updateBody, deleteBody] = calls.map((call) => JSON.parse(call.init.body));
  assert.equal(listBody.operationName, "getProducts");
  assert.match(listBody.query, /getProducts\(input: \$input\)/);
  assert.match(listBody.query, /items \{\s+ItemId\s+name\s+price\s+\}/);
  assert.deepEqual(listBody.variables.input, {
    filter: JSON.stringify({ status: "Active" }),
    pageNo: 2,
    pageSize: 5
  });

  assert.equal(getBody.operationName, "getProducts");
  assert.deepEqual(getBody.variables.input, {
    filter: JSON.stringify({ ItemId: "product-1" }),
    pageNo: 1,
    pageSize: 1
  });

  assert.equal(createBody.operationName, "insertProduct");
  assert.match(createBody.query, /mutation insertProduct\(\$input: ProductInsertInput!\)/);
  assert.deepEqual(createBody.variables.input, { name: "Laptop", price: 1200 });

  assert.equal(updateBody.operationName, "updateProduct");
  assert.match(updateBody.query, /mutation updateProduct\(\$filter: String, \$input: ProductUpdateInput!\)/);
  assert.equal(updateBody.variables.filter, JSON.stringify({ ItemId: "product-1" }));
  assert.deepEqual(updateBody.variables.input, { price: 1100 });

  assert.equal(deleteBody.operationName, "deleteProduct");
  assert.match(deleteBody.query, /mutation deleteProduct\(\$filter: String, \$input: ProductDeleteInput!\)/);
  assert.equal(deleteBody.variables.filter, JSON.stringify({ ItemId: "product-1" }));
  assert.deepEqual(deleteBody.variables.input, { isHardDelete: true });
});

test("data upload helpers support FormData and external pre-signed upload without Blocks headers", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.data.files.uploadToLocalStorage({
    file: new Blob(["hello"], { type: "text/plain" }),
    name: "a.txt",
    projectKey: "legacy-project-key"
  });
  await blocks.data.files.uploadToUrl({
    body: new Blob(["hello"], { type: "text/plain" }),
    contentType: "text/plain",
    url: "https://storage.example/upload"
  });

  assert.equal(calls[0].url, "https://api.seliseblocks.com/data/v4/files/upload-file-to-local-storage");
  assert.equal(calls[0].init.body instanceof FormData, true);
  assert.equal(Object.fromEntries(calls[0].init.headers)["x-blocks-key"], "tenant-1");
  assert.equal(calls[1].url, "https://storage.example/upload");
  assert.equal(Object.fromEntries(calls[1].init.headers)["content-type"], "text/plain");
  assert.equal(Object.fromEntries(calls[1].init.headers)["x-blocks-key"], undefined);
  assert.equal(Object.fromEntries(calls[1].init.headers).authorization, undefined);
});

test("falls back to a branded global fetch without losing its required Window-like receiver", async () => {
  const originalFetch = globalThis.fetch;
  function brandedFetch(url, init) {
    if (this !== globalThis) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    return jsonResponse({ url, headers: Object.fromEntries(new Headers(init?.headers)) });
  }
  globalThis.fetch = brandedFetch;

  try {
    const blocks = createBlocksClient({
      apiUrl: "https://api.seliseblocks.com/",
      xBlocksKey: "tenant-1"
    });

    const response = await blocks.http.request("/iam/v4/iam/me", { auth: false });
    assert.equal(response.url, "https://api.seliseblocks.com/iam/v4/iam/me");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("isAuthenticated validates against IAM auth/me instead of a locally cached token", async () => {
  let shouldSucceed = true;
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com/",
    fetch: async (url) => {
      assert.equal(url, "https://api.seliseblocks.com/iam/v4/auth/me");
      return shouldSucceed ? jsonResponse({ sub: "user-1" }) : jsonResponse({ message: "unauthorized" }, 401);
    },
    xBlocksKey: "tenant-1"
  });

  assert.equal(await blocks.auth.isAuthenticated(), true, "no local accessToken was configured, but IAM auth/me succeeded");

  shouldSucceed = false;
  assert.equal(await blocks.auth.isAuthenticated(), false, "IAM auth/me rejected the session cookie");
});

test("sends credentials so IAM's httpOnly session cookie reaches Blocks API and Auth/IdP endpoints, but never third-party external URLs", async () => {
  const calls = [];
  const blocks = createBlocksClient({
    apiUrl: "https://api.seliseblocks.com/",
    fetch: async (url, init) => {
      calls.push({ credentials: init?.credentials, url });
      return jsonResponse({ ok: true });
    },
    xBlocksKey: "tenant-1"
  });

  await blocks.auth.isAuthenticated();
  await blocks.http.request("/iam/v4/iam/me", { auth: false });
  await blocks.http.external("https://storage.example/upload", { method: "PUT" });

  assert.equal(calls[0].credentials, "include", "auth/me must send the session cookie");
  assert.equal(calls[1].credentials, "include", "Blocks API requests must send the session cookie");
  assert.equal(calls[2].credentials, undefined, "external() must not leak Blocks session credentials to third-party URLs");
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}
