import assert from "node:assert/strict";
import test from "node:test";
import { branchForEnvironment, branchMatchesEnvironment } from "../dist/lib/release.js";

test("each environment deploys from its documented branch", () => {
  const expected = {
    dev: "dev",
    test: "test",
    stg: "stg",
    iat: "iat",
    uat: "uat",
    "prod-shadow": "prod-shadow",
    "pre-prod": "pre-prod",
    prod: "main"
  };
  for (const [environment, branch] of Object.entries(expected)) {
    assert.equal(branchForEnvironment(environment), branch);
  }
});

test("production matches main, not prod", () => {
  assert.equal(branchMatchesEnvironment("main", "prod"), true);
  assert.equal(branchMatchesEnvironment("Main", "PROD"), true);
  assert.equal(branchMatchesEnvironment("prod", "prod"), false);
  assert.equal(branchMatchesEnvironment("main", "dev"), false);
  assert.equal(branchMatchesEnvironment(undefined, "dev"), false);
});
