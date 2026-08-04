import { access } from "node:fs/promises";
import { getAccountSession } from "../lib/auth.js";
import { configPath, getAccountProfile, readConfig } from "../lib/config.js";
import { parseFlags } from "../lib/args.js";
import { writeOutput } from "../lib/output.js";
import { isExpiring } from "../lib/token.js";
import { readTokenStore, tokenPath, tokenStoreInfo } from "../lib/token-store.js";
import { secretPath, secretStoreInfo } from "../lib/secret-store.js";

export async function doctor(argv: string[] = []): Promise<void> {
  const { flags } = parseFlags(argv);
  const config = await readConfig();
  let store = await readTokenStore();
  const tokenInfo = await tokenStoreInfo();
  let hasFailure = false;

  const checks: Array<{ label: string; ok: boolean; detail: string }> = [
    { label: "Node.js >= 20", ok: Number(process.versions.node.split(".")[0]) >= 20, detail: process.version },
    { label: "OIDC account configured", ok: Object.keys(config.accounts).length > 0, detail: config.activeAccount ?? "missing" }
  ];

  if (Object.keys(config.accounts).length > 0) {
    const { name } = getAccountProfile(config);
    const secretInfo = await secretStoreInfo();
    const accountToken = store.accounts[name]?.account;
    let sessionValid = false;
    let sessionDetail = "missing";

    if (accountToken?.accessToken) {
      try {
        const account = await getAccountSession(name);
        store = await readTokenStore();
        sessionValid = true;
        sessionDetail = account.accountTenant;
      } catch (error) {
        sessionDetail = (error as Error).message;
      }
    }

    const refreshedAccountToken = store.accounts[name]?.account;
    const projectToken = config.selectedProject?.tenantId
      ? store.accounts[name]?.projects?.[config.selectedProject.tenantId]
      : undefined;

    checks.push(
      { label: "Credential storage backend", ok: true, detail: `${secretInfo.backend} (${secretInfo.detail})` },
      { label: "Account session", ok: sessionValid, detail: sessionDetail },
      { label: "Account refresh token", ok: Boolean(refreshedAccountToken?.refreshToken), detail: refreshedAccountToken?.refreshToken ? "available" : "missing" },
      { label: "Account access token cached", ok: Boolean(refreshedAccountToken?.accessToken && !isExpiring(refreshedAccountToken.expiresAt)), detail: refreshedAccountToken?.expiresAt ?? "missing" },
      { label: "Project selected", ok: Boolean(config.selectedProject?.tenantId), detail: config.selectedProject?.tenantId ?? "missing" },
      { label: "Project access token cached", ok: Boolean(!projectToken?.accessToken || !isExpiring(projectToken.expiresAt)), detail: projectToken?.expiresAt ?? "not created yet" }
    );
  }

  let configFile = "missing";
  try {
    await access(configPath());
    configFile = configPath();
  } catch {
    // keep missing state
  }

  let tokenFile = tokenInfo.path ?? tokenInfo.detail;
  try {
    await access(tokenPath());
    tokenFile = tokenPath();
  } catch {
    // Native token backends do not need tokens.json to exist.
  }

  let secretFile = secretInfoForDoctor(tokenInfo.backend);
  try {
    await access(secretPath());
    secretFile = secretPath();
  } catch {
    // Native credential backends do not need secrets.json to exist.
  }

  checks.push(
    { label: "config file", ok: configFile !== "missing", detail: configFile === "missing" ? configPath() : configFile },
    { label: "token store", ok: true, detail: `${tokenInfo.backend} (${tokenInfo.detail}) ${tokenFile}` },
    { label: "secret store", ok: secretFile !== "missing", detail: secretFile === "missing" ? secretPath() : secretFile }
  );

  for (const check of checks) {
    if (!check.ok) hasFailure = true;
  }

  if (flags.json) {
    writeOutput({ ok: !hasFailure, checks }, flags);
  } else {
    for (const check of checks) {
      console.log(`${check.ok ? "ok" : "missing"}  ${check.label}  ${check.detail}`);
    }
  }

  if (hasFailure) process.exitCode = 1;
}

function secretInfoForDoctor(tokenBackend: string): string {
  return tokenBackend === "file" || tokenBackend === "windows-dpapi" ? "missing" : "native credential store";
}
