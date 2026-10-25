// Regressions for blocks-site reports 95737817 (notify) and 3b86fd8d (email checks by POST).
import assert from "node:assert/strict";
import test from "node:test";
import { createBlocksClient } from "../dist/index.js";

function setup() {
  const calls = [];
  const blocks = createBlocksClient({
    accessToken: () => "user-token",
    apiUrl: "https://api.example.test",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined, headers: Object.fromEntries(new Headers(init.headers)) });
      return new Response(JSON.stringify({ isSuccess: true, isAvailable: true }), { headers: { "content-type": "application/json" } });
    },
    xBlocksKey: "tenant-1"
  });
  return { blocks, calls };
}

test("notifier.notify fills the server-required filler fields, caller values win", async () => {
  const { blocks, calls } = setup();
  await blocks.notifier.notify({ configurationName: "in-app", userIds: ["u1"], denormalizedPayload: "{}" });
  assert.deepEqual(calls[0].body, {
    connectionId: "server", responseKey: "notification", responseValue: "notification",
    configurationName: "in-app", userIds: ["u1"], denormalizedPayload: "{}"
  });
  await blocks.notifier.notify({ configurationName: "in-app", roles: ["admin"], denormalizedPayload: "{}", responseKey: "order" });
  assert.equal(calls[1].body.responseKey, "order");
});

test("iam.users.emailAvailable and exists send the address in a POST body, not the URL", async () => {
  const { blocks, calls } = setup();
  await blocks.iam.users.emailAvailable({ email: "a@example.test" });
  assert.equal(calls[0].url, "https://api.example.test/iam/v4/iam/email/available");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].body, { email: "a@example.test" });
  assert.equal(calls[0].headers.authorization, undefined);

  await blocks.iam.users.exists("a@example.test");
  assert.equal(calls[1].url, "https://api.example.test/iam/v4/iam/users/exists");
  assert.deepEqual(calls[1].body, { email: "a@example.test" });
});

test("iam.users.activate sends userId and reason", async () => {
  const { blocks, calls } = setup();
  await blocks.iam.users.activate({ userId: "u1", reason: "returning" });
  assert.deepEqual(calls[0].body, { userId: "u1", reason: "returning" });
});
