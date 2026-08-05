---
name: blocks-data-gateway-crud
description: "Implement create/read/update/delete against a SELISE Blocks project's runtime Data Gateway using the @seliseblocks/client SDK. Use data.collection(schemaName) for straightforward per-item CRUD, data.graphql() for joins or custom query shapes, and data.schemas.*/data.validations.* for schema/validation metadata. Shows how to wire CRUD into the React 18 + Vite + TanStack Query app that blocks new web scaffolds. Use whenever the user wants to read or write actual records through a Blocks Data schema from app code."
---

# Blocks Data - Gateway CRUD

Once a schema exists and has been reloaded via the blocks-data-gateway-configuration skill, the Data Gateway exposes runtime records through GraphQL. This skill shows how to use the generated app's shared `@seliseblocks/client` instance for CRUD. Do not use raw `fetch` or `curl` against Blocks APIs from app code.

Prerequisite: a project selected via `blocks use` and an app scaffolded with `blocks new web <name> ...`. If either is missing, run the blocks-onboarding skill first.

## Use the Existing Client

The scaffold creates one `createBlocksClient()` call in `src/lib/blocks/client.ts`:

```ts
import { createBlocksClient } from "@seliseblocks/client";
import { blocksConfig } from "./config";
import { getValidAccessToken } from "./auth";

export const blocksClient = createBlocksClient({
  accessToken: () => getValidAccessToken(),
  apiUrl: blocksConfig.apiUrl,
  appDomain: blocksConfig.appDomain,
  oidc: { clientId: blocksConfig.oidcClientId, scope: blocksConfig.oidcScope, url: blocksConfig.oidcUrl },
  xBlocksKey: blocksConfig.xBlocksKey
});
```

Import that existing instance from feature code. Do not create a second client.

- `xBlocksKey` is the project's public tenant key from `VITE_BLOCKS_X_BLOCKS_KEY`.
- The SDK does not add `ProjectKey` to runtime Data calls.
- The HTTP client sends `credentials: "include"` so hosted-login session cookies are included.
- Never use the CLI's impersonation token or project token in browser code.

## Preferred CRUD Helper

Use `blocksClient.data.collection<T>(schemaName, options)` for normal CRUD. Pass the schema name, not the collection name. For a schema named `Product` with collection `Products`, pass `"Product"`.

```ts
const products = blocksClient.data.collection<Product>("Product", {
  fields: ["name", "price", "status"]
});

products.list({ pageNo: 1, pageSize: 20 });
products.get(itemId);
products.create(payload);
products.update(itemId, payload);
products.delete(itemId);
```

What the helper does:

- `list` and `get` call `query getProducts($input: DynamicQueryInput)`.
- `create` calls `mutation insertProduct($input: ProductInsertInput!)`.
- `update` calls `mutation updateProduct($filter: String, $input: ProductUpdateInput!)`.
- `delete` calls `mutation deleteProduct($filter: String, $input: ProductDeleteInput!)`.
- `get`, `update`, and `delete` address records by `ItemId`.
- `fields` controls the GraphQL selection for returned items; `ItemId` is always selected.

`list` accepts paging plus optional GraphQL dynamic input values:

```ts
await products.list({
  pageNo: 1,
  pageSize: 20,
  filter: { status: "Active" },
  sort: { name: 1 }
});
```

For search, only send filters that the schema/runtime actually supports. If unsure, start with simple paging and client-side filtering, or inspect the schema first.

## Product Example

```ts
// src/features/products/productsApi.ts
import { blocksClient } from "../../lib/blocks/client";

export type Product = Record<string, unknown> & {
  itemId?: string;
  id?: string;
  name?: string;
  price?: number;
  status?: string;
};

export type ProductInput = { name: string; price: number; status: string };

const products = blocksClient.data.collection<Product>("Product", {
  fields: ["name", "price", "status"]
});

export async function listProducts({ page, pageSize }: { page: number; pageSize: number }) {
  const response = await products.list({ pageNo: page, pageSize });
  return normalizeProductList(response);
}

export function createProduct(input: ProductInput) {
  return products.create(input);
}

export function updateProduct(product: Product) {
  return products.update(productId(product), product);
}

export function deleteProduct(product: Product) {
  return products.delete(productId(product));
}

function productId(product: Product): string {
  const id = product.itemId ?? product.id;
  if (!id) throw new Error("Product item id is missing.");
  return String(id);
}

function normalizeProductList(response: unknown): { items: Product[]; totalCount: number } {
  const record = response as {
    data?: {
      getProducts?: { items?: Product[]; totalCount?: number };
      items?: Product[];
      totalCount?: number;
    };
    items?: Product[];
    totalCount?: number;
  };
  const gateway = record.data?.getProducts;
  const items = gateway?.items ?? record.data?.items ?? record.items ?? [];
  return { items, totalCount: gateway?.totalCount ?? record.data?.totalCount ?? record.totalCount ?? items.length };
}
```

```ts
// src/features/products/useProducts.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProduct, deleteProduct, listProducts, updateProduct } from "./productsApi";
import type { Product, ProductInput } from "./productsApi";

export function useProductsQuery(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["products", page, pageSize],
    queryFn: () => listProducts({ page, pageSize })
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  return {
    create: useMutation({ mutationFn: (input: ProductInput) => createProduct(input), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (product: Product) => updateProduct(product), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (product: Product) => deleteProduct(product), onSuccess: invalidate })
  };
}
```

## When to Use `data.graphql()`

Use `data.graphql({ query, variables, operationName })` when the collection helper is too small:

- joins across schemas;
- custom nested selections;
- generated `where`, `order`, or `paging` arguments;
- bulk operations such as `insertManyProduct`.

Example:

```ts
const result = await blocksClient.data.graphql({
  operationName: "getProducts",
  query: `
    query getProducts($input: DynamicQueryInput) {
      getProducts(input: $input) {
        items { ItemId name price status }
        totalCount
      }
    }
  `,
  variables: { input: { pageNo: 1, pageSize: 20 } }
});
```

## Schema Metadata

Use `data.schemas.*` when building dynamic UI:

- `data.schemas.list(options)` or `data.schemas.get(schemaName)` for discovery;
- `data.schemas.infoByName(schemaName)` for field-level metadata;
- `data.schemas.info()` for general schema info;
- `data.schemas.aggregation(options)` for summary views;
- `data.schemas.getById(id)` when you already have the schema id.

Use `data.validations.*` to read field-level validation rules at runtime (e.g. to drive client-side form validation from the same rules the backend enforces):

- `data.validations.list(options)` for all rules, with optional schema/field/paging filters;
- `data.validations.bySchemaId(schemaId)` for every rule on one schema;
- `data.validations.bySchemaAndField({ schemaId, fieldName })` for one field's rule;
- `data.validations.getById(id)` when you already have the validation id.

Validation rules are authored and saved separately via `blocks data validation save` (see the blocks-data-gateway-configuration skill); this SDK namespace only reads them.

## Gotchas

- Pass schema name, not collection name: `Product`, not `Products`.
- Generated query names pluralize by appending `s`: `getProducts`.
- Generated mutation names stay singular: `insertProduct`, `updateProduct`, `deleteProduct`.
- Dynamic item selections use schema field names such as `ItemId`, `name`, `price`.
- Mutation response fields are lower camel case: `acknowledged`, `itemId`, `message`, `totalImpactedData`.
- If GraphQL says the field does not exist, the schema probably has not been created or reloaded.
- Keep one `blocksClient` per app.

## Prompt Routing

```text
Wire create/read/update/delete for Product into my React app          -> this skill
Build a paged table of Orders in the dashboard                       -> this skill
I need a GraphQL query that joins Orders with Customer details        -> this skill, data.graphql
Build a dynamic form from my schema's field metadata                  -> this skill, data.schemas.infoByName
Create a Product schema with title/price and reload it                -> blocks-data-gateway-configuration
Upload a PDF and get a download link                                  -> blocks-data-storage
```
