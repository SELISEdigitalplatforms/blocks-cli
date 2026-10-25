import assert from "node:assert/strict";
import test from "node:test";
import { BlocksApiError, BlocksFunctionRunError, createBlocksClient } from "../dist/index.js";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", ...headers }, status });
}

function client(handler, extra = {}) {
  const calls = [];
  const blocks = createBlocksClient({
    accessToken: () => "user-token",
    apiUrl: "https://api.example.test/",
    fetch: async (url, init) => {
      const call = { url: String(url), init, headers: Object.fromEntries(new Headers(init.headers)) };
      calls.push(call);
      return handler(call, calls.length);
    },
    xBlocksKey: "tenant-1",
    ...extra
  });
  return { blocks, calls };
}

test("functions.url and proxy.url compose the public gateway routes", () => {
  const { blocks } = client(() => json({}));
  assert.equal(blocks.logic.functions.url("fn-1"), "https://api.example.test/logic/v4/fn/fn-1");
  assert.equal(blocks.logic.functions.url("fn-1", "/orders/42/"), "https://api.example.test/logic/v4/fn/fn-1/orders/42");
  assert.equal(blocks.logic.proxy.url("stripe", "charges"), "https://api.example.test/logic/v4/proxy/gateway/stripe/charges");
});

test("functions.invoke returns a sync answer with status, headers and body", async () => {
  const { blocks, calls } = client(() => json({ order: 42 }, 201, { "x-blocks-run-id": "run-1" }));
  const result = await blocks.logic.functions.invoke("fn-1", {
    method: "POST", path: "orders", query: { tag: ["a", "b"] }, body: { id: 42 }, waitSeconds: 10
  });
  assert.equal(result.kind, "answered");
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { order: 42 });
  assert.equal(result.runId, "run-1");
  assert.equal(calls[0].url, "https://api.example.test/logic/v4/fn/fn-1/orders?tag=a&tag=b");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body, "{\"id\":42}");
  assert.equal(calls[0].headers.prefer, "wait=10");
  assert.equal(calls[0].headers.authorization, "Bearer user-token");
  assert.equal(calls[0].headers["x-blocks-key"], "tenant-1");
});

test("functions.invoke reports a 202 as accepted; auth:false sends no token", async () => {
  const { blocks, calls } = client(() => json({ runId: "run-2", status: "QUEUED", pollToken: "pt" }, 202));
  const result = await blocks.logic.functions.invoke("fn-1", { auth: false, respondAsync: true });
  assert.deepEqual(result, { kind: "accepted", status: 202, runId: "run-2", runStatus: "QUEUED", pollToken: "pt" });
  assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(calls[0].headers.prefer, "respond-async");
});

test("functions.invoke throws BlocksApiError for a platform refusal", async () => {
  const { blocks } = client(() => json({ code: "FUNCTION_INVOKE_FORBIDDEN", message: "no", instance: "/x" }, 403));
  await assert.rejects(blocks.logic.functions.invoke("fn-1"), (error) => {
    assert.ok(error instanceof BlocksApiError);
    assert.equal(error.status, 403);
    assert.equal(error.body.code, "FUNCTION_INVOKE_FORBIDDEN");
    return true;
  });
});

test("functions.call waits on an async run and unwraps an HTTP-shaped result", async () => {
  const { blocks, calls } = client((call, n) => {
    if (n === 1) return json({ runId: "run-3", status: "QUEUED", pollToken: "pt-3" }, 202);
    if (n === 2) return json({ runId: "run-3", status: "RUNNING" });
    return json({ runId: "run-3", status: "SUCCEEDED", result: JSON.stringify({ statusCode: 200, body: { total: 7 } }) });
  });
  const value = await blocks.logic.functions.call("fn-1", { intervalMs: 1 });
  assert.deepEqual(value, { total: 7 });
  assert.equal(calls[1].url, "https://api.example.test/logic/v4/fn/runs/run-3/result");
  assert.equal(calls[1].headers["x-poll-token"], "pt-3");
  assert.equal(calls[1].headers.authorization, undefined, "the poll token is the credential");
});

test("functions.call throws BlocksFunctionRunError for a failed run", async () => {
  const { blocks } = client((call, n) => n === 1
    ? json({ runId: "run-4", status: "QUEUED", pollToken: "pt" }, 202)
    : json({ runId: "run-4", status: "FAILED", errorCode: "UserRuntimeError", errorMessage: "boom" }));
  await assert.rejects(blocks.logic.functions.call("fn-1", { intervalMs: 1 }), (error) => {
    assert.ok(error instanceof BlocksFunctionRunError);
    assert.equal(error.status, "FAILED");
    assert.equal(error.errorCode, "UserRuntimeError");
    return true;
  });
});

test("functions.waitForResult gives up at timeoutMs", async () => {
  const { blocks } = client(() => json({ runId: "run-5", status: "RUNNING" }));
  await assert.rejects(
    blocks.logic.functions.waitForResult({ runId: "run-5", pollToken: "pt" }, { intervalMs: 5, timeoutMs: 20 }),
    /still RUNNING/
  );
});

test("proxy.request calls the gateway route and throws on a gateway refusal", async () => {
  const { blocks, calls } = client((call, n) => n === 1
    ? json({ data: [1] })
    : json({ code: "PROXY_GATEWAY_RATELIMITED", message: "slow down" }, 429, { "retry-after": "3" }));
  assert.deepEqual(await blocks.logic.proxy.request("stripe", { path: "charges", query: { limit: 1 } }), { data: [1] });
  assert.equal(calls[0].url, "https://api.example.test/logic/v4/proxy/gateway/stripe/charges?limit=1");
  assert.equal(calls[0].init.method, "GET");

  const raw = await blocks.logic.proxy.requestRaw("stripe", { method: "POST", body: { a: 1 } });
  assert.equal(raw.status, 429);
  assert.equal(raw.headers.get("retry-after"), "3");
});

test("http.request still forces Accept: application/json", async () => {
  const { blocks, calls } = client(() => json({ ok: true }));
  await blocks.http.request("/iam/v4/iam/me", { headers: { Accept: "text/plain" } });
  assert.equal(calls[0].headers.accept, "application/json");
});

test("function and proxy routes trim slashes from the sub-path, also on a long run of them", async () => {
  const { trimSlashes } = await import("../dist/logic/route.js");
  assert.equal(trimSlashes("//orders/42//"), "orders/42");
  assert.equal(trimSlashes("/"), "");
  assert.equal(trimSlashes(""), "");
  const long = "/".repeat(100_000) + "x";
  const started = Date.now();
  assert.equal(trimSlashes(long + "/".repeat(100_000)), "x");
  assert.ok(Date.now() - started < 200, "linear, not quadratic");
});
