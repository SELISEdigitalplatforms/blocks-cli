# Author, test and deploy a function

The working loop: keep the function's code in the app repo, push it with `save --dir`, check it with `test`, ship it with `deploy`, then call it.

## 1. Create (or find) the function

```bash
blocks logic function list --search quote --json            # reuse an existing one if it is there
blocks logic function create --name shipping-quote --template minimal --dry-run --json
blocks logic function create --name shipping-quote --template minimal --yes --json   # note the "id"
```

## 2. Export it into the repo

```bash
blocks logic function export <id> --dir functions/shipping-quote --json
```

This writes:

| File | Holds |
|---|---|
| `index.js` | The handler — `export default async function handler(input, ctx) { … }` |
| `package.json` | Must keep `"type": "module"`. Dependencies go under `dependencies`. |
| `package-lock.json` | Optional. When present the build runs `npm ci` with exactly these versions. |
| `function.json` | Settings: `trigger`, `variables`, `outputActions`, `limits.requestsPerMinute`. |

Keep the function under `functions/<name>/`, not under `blocks/logic/` — that folder is a read-only `blocks pull` snapshot.

## 3. Write the handler

```js
// functions/shipping-quote/index.js
/** @type {import("@seliseblocks/client/functions").FunctionHandler} */
export default async function handler(input, ctx) {
  if (input.method !== "POST") return { statusCode: 405, body: { error: "POST only" } };
  const items = input.body?.items ?? [];
  const total = items.reduce((sum, item) => sum + item.qty * 4.5, 0);
  ctx.log.info("quoted", { count: items.length });
  return { total, currency: ctx.env.CURRENCY ?? "EUR" };
}
```

The `@type` comment is optional; with `@seliseblocks/client` installed as a devDependency it gives editor completion for `input` and `ctx`. The function's own `package.json` does not need it. Full contract: [../references/handler.md](../references/handler.md).

## 4. Save, then test

```bash
blocks logic function save <id> --dir functions/shipping-quote --var CURRENCY=EUR --response-mode sync --dry-run --json
blocks logic function save <id> --dir functions/shipping-quote --var CURRENCY=EUR --response-mode sync --yes --json
blocks logic function test <id> --input '{"items":[{"sku":"A1","qty":2}]}' --json
```

`test` builds the image when the source or dependencies changed (the first test after a dependency change is slow). If it answers with a `buildId` instead of a run, the build is still going: `blocks logic function build <buildId> --json`, then test again. A failed run's `errorMessage` and `blocks logic function logs <runId> --json` show what went wrong.

## 5. Deploy

```bash
blocks logic function deploy <id> --note "quotes v1" --dry-run --json
blocks logic function deploy <id> --note "quotes v1" --yes --json      # {"deployed": true, "version": {...}}
blocks logic function url <id> --json
```

## 6. Call it from the app

```ts
const { total } = await blocksClient.logic.functions.call<{ total: number }>("<id>", {
  body: { items: cart.items }
});
```

## Changing it later

Edit the files, `save --dir`, `test`, `deploy`. `blocks logic function list` shows `isDirty: true` while saved code is not yet deployed. To pick up edits made in the Studio, `export --force` first.
