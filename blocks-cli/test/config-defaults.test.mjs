import assert from "node:assert/strict";
import { test } from "node:test";
import { defaults } from "../dist/lib/config.js";

// I00-WP10: the three hosts are settings. Unset, they keep today's defaults.
const VARS = ["BLOCKS_CLI_API_URL", "BLOCKS_CLI_OIDC_URL", "BLOCKS_CLI_OS_URL"];

function withEnv(values, run) {
  const saved = Object.fromEntries(VARS.map((name) => [name, process.env[name]]));
  try {
    for (const name of VARS) {
      if (values[name] === undefined) delete process.env[name];
      else process.env[name] = values[name];
    }
    return run();
  } finally {
    for (const name of VARS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
}

test("hosts keep today's defaults when the variables are unset", () => {
  withEnv({}, () => {
    const d = defaults();
    assert.equal(d.apiUrl, "https://api.seliseblocks.com");
    assert.equal(d.oidcUrl, "https://iam.seliseblocks.com");
    assert.equal(d.osUrl, "https://api.seliseblocks.com");
  });
});

test("an empty variable counts as unset", () => {
  withEnv({ BLOCKS_CLI_API_URL: "   " }, () => {
    assert.equal(defaults().apiUrl, "https://api.seliseblocks.com");
  });
});

test("each host is replaced by its variable when it is set", () => {
  withEnv(
    {
      BLOCKS_CLI_API_URL: "https://api.selfhost.example",
      BLOCKS_CLI_OIDC_URL: "https://iam.selfhost.example",
      BLOCKS_CLI_OS_URL: "https://os.selfhost.example",
    },
    () => {
      const d = defaults();
      assert.equal(d.apiUrl, "https://api.selfhost.example");
      assert.equal(d.oidcUrl, "https://iam.selfhost.example");
      assert.equal(d.osUrl, "https://os.selfhost.example");
    },
  );
});
