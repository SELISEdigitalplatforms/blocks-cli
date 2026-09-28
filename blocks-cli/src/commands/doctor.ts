import { access } from "node:fs/promises";
import { configPath, readConfig, resolveAccountProfile } from "../lib/config.js";
import { parseFlags, stringFlag } from "../lib/args.js";
import { writeOutput } from "../lib/output.js";
import { isExpiring } from "../lib/token.js";
import { readTokenStore, tokenPath, tokenStoreInfo } from "../lib/token-store.js";
import { secretPath, secretStoreInfo } from "../lib/secret-store.js";
import { installedCliVersion, isNewerVersion, readUpdateCheckCache } from "../lib/update-check.js";
import { optionalSelectedProject } from "../lib/workspace.js";

export async function doctor(argv: string[] = []): Promise<void> {
  const { flags } = parseFlags(argv);
  const config = await readConfig();
  const store = await readTokenStore();
  const tokenInfo = await tokenStoreInfo();
  const accountOverride = stringFlag(flags, "account") || undefined;
  const tenantId = await optionalSelectedProject(flags);
  let hasFailure = false;

  // Latest version comes from the cache the post-command update notice
  // maintains, never a live lookup -- doctor's contract is no network request.
  // An empty cache (fresh install, BLOCKS_NO_UPDATE_CHECK, offline) reports
  // the installed version alone rather than failing the check.
  const cliVersion = await installedCliVersion();
  const latestCliVersion = (await readUpdateCheckCache())?.latest;
  const cliUpdateAvailable = Boolean(latestCliVersion && isNewerVersion(latestCliVersion, cliVersion));

  const checks: Array<{ label: string; ok: boolean; detail: string }> = [
    {
      label: "CLI up to date",
      ok: !cliUpdateAvailable,
      detail: cliUpdateAvailable
        ? `${cliVersion} (latest ${latestCliVersion}; ask the user before running 'npm install -g @seliseblocks/cli-os@latest')`
        : `${cliVersion}${latestCliVersion ? ` (latest ${latestCliVersion})` : " (latest unknown: no cached registry check yet)"}`
    },
    { label: "Node.js >= 20", ok: Number(process.versions.node.split(".")[0]) >= 20, detail: process.version },
    { label: "OIDC account configured", ok: Object.keys(config.accounts).length > 0, detail: config.activeAccount ?? "missing" }
  ];

  if (Object.keys(config.accounts).length > 0) {
    const { name } = await resolveAccountProfile(config, accountOverride, { allowPrompt: false });
    const secretInfo = await secretStoreInfo();
    const accountToken = store.accounts[name]?.account;
    const projectToken = tenantId
      ? store.accounts[name]?.projects?.[tenantId]
      : undefined;
    const accountAccessValid = Boolean(accountToken?.accessToken && !isExpiring(accountToken.expiresAt));
    const projectAccessValid = Boolean(projectToken?.accessToken && !isExpiring(projectToken.expiresAt));
    const sessionRefreshable = Boolean(accountToken?.refreshToken || projectToken?.refreshToken);
    const sessionValid = accountAccessValid || projectAccessValid || sessionRefreshable;
    const projectMode = Boolean(projectToken?.accessToken || projectToken?.refreshToken);

    checks.push(
      { label: "Credential storage backend", ok: true, detail: `${secretInfo.backend} (${secretInfo.detail})` },
      { label: "Current auth session", ok: sessionValid, detail: projectMode ? "project mode" : accountToken ? "account mode" : "missing" },
      { label: "Current refresh token", ok: sessionRefreshable, detail: sessionRefreshable ? "available" : "missing" },
      { label: "Current access token cached", ok: accountAccessValid || projectAccessValid, detail: (projectMode ? projectToken?.expiresAt : accountToken?.expiresAt) ?? "missing" },
      { label: "Project context", ok: true, detail: tenantId ?? "not selected (account-only mode)" }
    );
    if (tenantId) {
      checks.push({ label: "Project access token cached", ok: projectAccessValid, detail: projectToken?.expiresAt ?? "not created yet" });
    }
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
    // An outdated CLI is worth flagging but is not a broken install: scripts
    // and agents gating on doctor's exit code must not start failing the day
    // a new version is published.
    if (!check.ok && check.label !== "CLI up to date") hasFailure = true;
  }

  if (flags.json) {
    writeOutput({ ok: !hasFailure, cliVersion, latestCliVersion: latestCliVersion ?? null, cliUpdateAvailable, checks }, flags);
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
