import type { WebOptions } from "./types.js";
import { hostFromAppDomain, write } from "./fs.js";

// Project root: package.json, env files, README, build/tooling config, and the local-cert script.
export async function writeRootFiles(root: string, options: WebOptions): Promise<void> {
  const devHost = hostFromAppDomain(options.appDomain);

  await write(root, "package.json", JSON.stringify({
    name: options.name,
    private: true,
    type: "module",
    scripts: {
      build: "vite build",
      cert: "node scripts/generate-cert.mjs",
      dev: "vite",
      lint: "tsc --noEmit",
      preview: "vite preview"
    },
    engines: {
      node: "^20.19.0 || >=22.12.0"
    },
    dependencies: {
      "@radix-ui/react-dropdown-menu": "^2.1.24",
      "@seliseblocks/client": "^0.1.3",
      "@tanstack/react-query": "^5.101.4",
      clsx: "^2.1.1",
      "lucide-react": "^1.28.0",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "tailwind-merge": "^3.6.0"
    },
    devDependencies: {
      "@types/node": "^22.0.0",
      "@types/react": "^18.3.31",
      "@types/react-dom": "^18.3.7",
      "@vitejs/plugin-react": "^6.0.5",
      "autoprefixer": "^10.5.4",
      "postcss": "^8.5.25",
      "selfsigned": "^2.4.1",
      "tailwindcss": "^3.4.17",
      typescript: "^5.9.3",
      vite: "^8.2.0"
    }
  }, null, 2));

  await write(root, ".env.example", [
    `VITE_BLOCKS_API_URL=${options.apiUrl}`,
    "# This project's tenant id. Sent as the x-blocks-key header on every",
    "# Blocks API call, and as tenant_id on the OIDC login request -- both",
    "# mean the same thing: which Blocks tenant this app belongs to.",
    `VITE_BLOCKS_X_BLOCKS_KEY=${options.xBlocksKey}`,
    `VITE_BLOCKS_APP_DOMAIN=${options.appDomain}`,
    `VITE_BLOCKS_OIDC_URL=${options.oidcUrl}`,
    "# Public browser OIDC client (hosted IAM IdP flow, no secret). Register it in Blocks IAM",
    "# with redirect_uris for both your dev origin and VITE_BLOCKS_APP_DOMAIN.",
    `VITE_BLOCKS_OIDC_CLIENT_ID=${options.oidcClientId ?? ""}`,
    "VITE_BLOCKS_OIDC_SCOPE=openid profile",
    "# Set to your project's real domain (Project/Gets -> applications[].domain,",
    "# no scheme) to test OIDC login locally over HTTPS -- see README.md.",
    `VITE_BLOCKS_DEV_HOST=${devHost}`,
    "VITE_BLOCKS_DEV_PORT=5173",
    ""
  ].join("\n"));

  await write(root, ".env", [
    `VITE_BLOCKS_API_URL=${options.apiUrl}`,
    `VITE_BLOCKS_X_BLOCKS_KEY=${options.xBlocksKey}`,
    `VITE_BLOCKS_APP_DOMAIN=${options.appDomain}`,
    `VITE_BLOCKS_OIDC_URL=${options.oidcUrl}`,
    `VITE_BLOCKS_OIDC_CLIENT_ID=${options.oidcClientId ?? ""}`,
    "VITE_BLOCKS_OIDC_SCOPE=openid profile",
    `VITE_BLOCKS_DEV_HOST=${devHost}`,
    "VITE_BLOCKS_DEV_PORT=5173",
    ""
  ].join("\n"));

  await write(root, ".gitignore", [
    "node_modules/",
    "dist/",
    ".env",
    ".env.local",
    ".env.*.local",
    ".cert/",
    ""
  ].join("\n"));

  await write(root, "README.md", [
    `# ${options.name}`,
    "",
    "Blocks starter app: React 18 + Vite + TypeScript, with a real hosted Blocks IAM login and a project-scoped profile page.",
    "",
    "Every Blocks API call in this app goes through [`@seliseblocks/client`](https://www.npmjs.com/package/@seliseblocks/client) via a single `createBlocksClient()` instance in `src/lib/blocks/client.ts` — there is no hand-written `fetch()` wrapper for Blocks endpoints anywhere in this app. Each SDK module is exercised in context rather than in one dedicated demo panel: `auth` in the hosted login flow, `iam` on the Profile page and user menu, `data` in Assets, and `localization` in `LocalizationProvider`.",
    "",
    "## Setup",
    "",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "",
    "`.env` already has working defaults for this project — you only need to fill in `VITE_BLOCKS_OIDC_CLIENT_ID` (see below) before login will work.",
    "",
    "## Login setup (required)",
    "",
    "This app signs users in directly against this project's tenant (no CLI-style account impersonation) through Blocks IAM's hosted IdP controller. Before login will work, register a **public** OIDC client for this app in Blocks IAM with:",
    "",
    "- `redirect_uris`: both your dev origin and production origin, each with `/login/callback`, e.g. `http://localhost:5173/login/callback` and `https://<your-app-domain>/login/callback`.",
    "- `client_type`: `public` (no client secret — this is a browser app and cannot keep one; this scaffold never asks for or ships a client secret).",
    "- `tenant_id` used for login: this project's tenant (`VITE_BLOCKS_X_BLOCKS_KEY`).",
    "",
    "Then set `VITE_BLOCKS_OIDC_CLIENT_ID` in `.env` to the new client's id. Until then, the login page shows a setup notice instead of failing silently.",
    "",
    "## Testing login locally over HTTPS on the real project domain",
    "",
    "Blocks SSO sets a **Secure, domain-scoped** session-related cookie as part of the OIDC exchange; browsers refuse to store or send that on plain `http://localhost`. To test the real login flow locally, run the dev server on the project's actual domain over HTTPS instead of `localhost`:",
    "",
    "1. Find the app's registered Blocks domain in the Blocks OS project settings, or ask whoever created the project. It must match the OIDC redirect URI's host.",
    "2. Point it at your machine — add to your hosts file (`/etc/hosts`, or `C:\\Windows\\System32\\drivers\\etc\\hosts` as Administrator): `127.0.0.1  <domain>`.",
    "3. Confirm `.env` has `VITE_BLOCKS_DEV_HOST=<domain>` (generated from `--app-domain`) and `VITE_BLOCKS_DEV_PORT=5173`.",
    "4. Generate a local HTTPS cert for that exact domain: `npm run cert`. Trust it in your OS store to remove the browser warning (command printed by the script), then restart the browser.",
    "5. `npm run dev` -> open `https://<domain>:<port>` (not `localhost`).",
    "6. Register that exact origin's `/login/callback` as a redirect URI on the OIDC client — byte-for-byte, including the port.",
    "",
    "`.cert/` is gitignored — each developer generates and trusts their own cert.",
    "",
    "## What's included",
    "",
    "- `/login` — login page (redirects to Blocks IAM).",
    "- `/login/callback` — completes the hosted IAM callback via `blocksClient.auth.idp.callback()`, then returns to the page you started from.",
    "- `/` and `/profile` — protected; redirect to `/login` when signed out.",
    "- Sidebar + topbar shell matching the `@seliseblocks/blocks-kit` look (icon-only rail on narrow screens, avatar dropdown, notifications menu, active-item accent bar).",
    "- `blocks/localization/*.en.json` local i18n seed files for AI or human edits. Sync them through `blocks localization validate` and `blocks localization push`; the runtime app reads Localization service data through `blocksClient.localization`.",
    "",
    "IAM's hosted login sets the session as a **Secure, httpOnly** cookie by default -- this app never reads, stores, or refreshes a token itself. \"Signed in\" is determined by calling `blocksClient.auth.userInfo()` (`GET /iam/v4/auth/me`), which the browser's cookie authenticates automatically; this is different from `blocksClient.iam.me()`, the full IAM profile call used on the Profile page. Logging out calls `blocksClient.auth.logout()` so IAM ends the session server-side. A cached bearer token (and `blocksClient.auth.oidc.refreshToken()` to refresh it) is only used if a tenant's OIDC config explicitly returns tokens in the response body instead of a cookie.",
    ""
  ].join("\n"));

  await write(root, "tsconfig.json", JSON.stringify({
    compilerOptions: {
      jsx: "react-jsx",
      module: "ESNext",
      moduleResolution: "Bundler",
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      strict: true,
      target: "ES2022",
      types: ["vite/client"],
      useDefineForClassFields: true
    },
    include: ["src", "tailwind.config.ts", "vite.config.ts"]
  }, null, 2));

  await write(root, "vite.config.ts", [
    "import react from \"@vitejs/plugin-react\";",
    "import fs from \"node:fs\";",
    "import { defineConfig, loadEnv } from \"vite\";",
    "",
    "// VITE_BLOCKS_DEV_HOST: set this in .env to your project's real domain",
    "// (from Project/Gets -> applications[].domain) to test OIDC login locally",
    "// -- Blocks SSO sets a Secure, domain-scoped cookie that browsers refuse",
    "// on plain http://localhost. Run `npm run cert` once that's set, then",
    "// trust the generated .cert/dev-cert.pem. See README.md.",
    "export default defineConfig(({ mode }) => {",
    "  // Vite does not inject .env values into process.env for its own config",
    "  // file -- loadEnv reads .env/.env.local explicitly (third arg \"\" loads",
    "  // every key, not just VITE_-prefixed ones, though ours already are).",
    "  const env = loadEnv(mode, process.cwd(), \"\");",
    "  const domain = env.VITE_BLOCKS_DEV_HOST || undefined;",
    "  const port = Number(env.VITE_BLOCKS_DEV_PORT || 5173);",
    "  const https = fs.existsSync(\".cert/dev-key.pem\") && fs.existsSync(\".cert/dev-cert.pem\")",
    "    ? { key: fs.readFileSync(\".cert/dev-key.pem\"), cert: fs.readFileSync(\".cert/dev-cert.pem\") }",
    "    : undefined;",
    "",
    "  return {",
    "    plugins: [react()],",
    "    server: {",
    "      // Vite blocks unrecognized Host headers by default (DNS-rebinding",
    "      // protection) -- without this, a custom domain 404s with \"Blocked",
    "      // request. This host is not allowed\" even once hosts + cert are set.",
    "      allowedHosts: domain ? [domain] : undefined,",
    "      host: domain || \"0.0.0.0\",",
    "      https,",
    "      port,",
    "      // Keep the port fixed: it's part of the registered OIDC redirect_uri.",
    "      strictPort: true",
    "    }",
    "  };",
    "});",
    ""
  ].join("\n"));

  await write(root, "postcss.config.js", [
    "export default {",
    "  plugins: {",
    "    tailwindcss: {},",
    "    autoprefixer: {}",
    "  }",
    "};",
    ""
  ].join("\n"));

  await write(root, "tailwind.config.ts", [
    "import type { Config } from \"tailwindcss\";",
    "",
    "export default {",
    "  content: [\"./index.html\", \"./src/**/*.{ts,tsx}\"],",
    "  theme: {",
    "    extend: {",
    "      colors: {",
    "        ink: \"#18181b\",",
    "        surface: \"#f6f7f9\"",
    "      }",
    "    }",
    "  },",
    "  plugins: []",
    "} satisfies Config;",
    ""
  ].join("\n"));

  await write(root, "index.html", [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    "    <title>Blocks App</title>",
    "  </head>",
    "  <body>",
    "    <div id=\"root\"></div>",
    "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
    "  </body>",
    "</html>",
    ""
  ].join("\n"));

  await write(root, "scripts/generate-cert.mjs", [
    "#!/usr/bin/env node",
    "// Generates a self-signed HTTPS cert for local Blocks SSO testing.",
    "// Uses a Node dependency so this works from normal PowerShell after npm install.",
    "import { existsSync, mkdirSync, readFileSync, writeFileSync } from \"node:fs\";",
    "import selfsigned from \"selfsigned\";",
    "",
    "const domain = readDevHost() || process.argv[2];",
    "",
    "if (!domain) {",
    "  console.error(\"No domain given. Set VITE_BLOCKS_DEV_HOST in .env, or run: npm run cert -- <domain>\");",
    "  console.error(\"Use the project's real domain (Project/Gets -> applications[].domain) -- never a guessed one.\");",
    "  process.exit(1);",
    "}",
    "",
    "mkdirSync(\".cert\", { recursive: true });",
    "",
    "const pems = selfsigned.generate([{ name: \"commonName\", value: domain }], {",
    "  algorithm: \"sha256\",",
    "  days: 365,",
    "  extensions: [",
    "    {",
    "      altNames: [",
    "        { type: 2, value: domain },",
    "        { type: 2, value: \"localhost\" },",
    "        { ip: \"127.0.0.1\", type: 7 }",
    "      ],",
    "      name: \"subjectAltName\"",
    "    }",
    "  ],",
    "  keySize: 2048",
    "});",
    "",
    "writeFileSync(\".cert/dev-key.pem\", pems.private);",
    "writeFileSync(\".cert/dev-cert.pem\", pems.cert);",
    "",
    "console.log(\"\");",
    "console.log(`Wrote .cert/dev-cert.pem and .cert/dev-key.pem for \"${domain}\" (SAN: ${domain}, localhost, 127.0.0.1).`);",
    "console.log(\"\");",
    "console.log(\"Trust it to remove the browser warning, then restart the browser:\");",
    "console.log(\"  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .cert/dev-cert.pem\");",
    "console.log(\"  Windows: certutil -addstore -f Root .cert\\\\dev-cert.pem   (run from an elevated prompt)\");",
    "console.log(\"  Linux:   sudo cp .cert/dev-cert.pem /usr/local/share/ca-certificates/blocks-dev.crt && sudo update-ca-certificates\");",
    "console.log(\"\");",
    "console.log(`Make sure \"127.0.0.1  ${domain}\" is in your hosts file, then run: npm run dev`);",
    "",
    "function readDevHost() {",
    "  if (process.env.VITE_BLOCKS_DEV_HOST) return process.env.VITE_BLOCKS_DEV_HOST;",
    "  if (!existsSync(\".env\")) return undefined;",
    "",
    "  const match = readFileSync(\".env\", \"utf8\").match(/^VITE_BLOCKS_DEV_HOST=(.*)$/m);",
    "  return match ? match[1].trim() : undefined;",
    "}",
    ""
  ].join("\n"));

}
