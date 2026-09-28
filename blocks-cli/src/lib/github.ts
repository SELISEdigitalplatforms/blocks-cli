import { randomBytes } from "node:crypto";
import { blocksRequest } from "./api.js";
import { readConfig, resolveAccountProfile } from "./config.js";
import { CliActionableError } from "./errors.js";
import { RELEASE_API } from "./release.js";
import { requestContext } from "./request-context.js";

export const GITHUB_CONNECT_SCOPES = ["repo", "user:email", "read:user", "read:repo_hook"] as const;
export const GITHUB_CONNECT_POLL_INTERVAL_SECONDS = 5;
export const GITHUB_CONNECT_DEFAULT_TIMEOUT_SECONDS = 300;

type Flags = Record<string, string | boolean>;

type CredentialResponse = { username?: string; token?: string; login?: string; expiresAt?: string | null };

export type GithubConnection = {
  connected: boolean;
  login?: string;
  scopes?: string[];
  tokenPresent?: boolean;
};

export function buildGithubAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", GITHUB_CONNECT_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export function newGithubOAuthState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Public OAuth client id used by blocks-release's own "Connect GitHub" button.
 * Prefer an explicit env override (tests / air-gapped), else scrape the release
 * SPA's index.html for window.__BLOCKS_ENV__.BLOCKS_GITHUB_SSO_CLIENT_ID.
 */
export async function resolveGithubOauthClientId(flags: Flags): Promise<string> {
  const fromEnv = (process.env.BLOCKS_GITHUB_SSO_CLIENT_ID ?? "").trim();
  if (fromEnv && !fromEnv.includes("__BLOCKS_GITHUB_SSO_CLIENT_ID__")) return fromEnv;

  const candidates = await githubClientIdCandidateUrls(flags);
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const clientId = await fetchGithubClientIdFromHtml(candidate);
      if (clientId) return clientId;
      errors.push(`${candidate}: no BLOCKS_GITHUB_SSO_CLIENT_ID in page`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }

  throw new CliActionableError(
    "Could not resolve the GitHub OAuth client id from blocks-release.",
    "github_client_id_unavailable",
    errors.length > 0
      ? `Tried: ${errors.join("; ")}. Set BLOCKS_GITHUB_SSO_CLIENT_ID or BLOCKS_RELEASE_WEB_URL and re-run.`
      : "Set BLOCKS_GITHUB_SSO_CLIENT_ID or BLOCKS_RELEASE_WEB_URL and re-run."
  );
}

async function githubClientIdCandidateUrls(flags: Flags): Promise<string[]> {
  const urls: string[] = [];
  const releaseWeb = (process.env.BLOCKS_RELEASE_WEB_URL ?? "").trim().replace(/\/+$/, "");
  if (releaseWeb) urls.push(releaseWeb, `${releaseWeb}/index.html`);

  const config = await readConfig();
  const { profile } = await resolveAccountProfile(config, typeof flags.account === "string" ? flags.account : undefined);
  const apiUrl = (typeof flags["api-url"] === "string" && flags["api-url"] ? flags["api-url"] : profile.apiUrl).replace(/\/+$/, "");
  urls.push(apiUrl, `${apiUrl}/`, `${apiUrl}/index.html`);

  try {
    const parsed = new URL(apiUrl);
    const host = parsed.hostname;
    const rewritten = host
      .replace(/^api\./i, "release.")
      .replace(/^blocksapi\./i, "release.")
      .replace(/^dev-api-/i, "dev-release-")
      .replace(/^stg-api-/i, "stg-release-");
    if (rewritten !== host) {
      const origin = `${parsed.protocol}//${rewritten}${parsed.port ? `:${parsed.port}` : ""}`;
      urls.push(origin, `${origin}/`, `${origin}/index.html`);
    }
  } catch {
    // ignore malformed api url; other candidates still tried
  }

  return [...new Set(urls)];
}

async function fetchGithubClientIdFromHtml(url: string): Promise<string | undefined> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml,application/json" },
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  return parseGithubClientIdFromHtml(text);
}

export function parseGithubClientIdFromHtml(html: string): string | undefined {
  const patterns = [
    /BLOCKS_GITHUB_SSO_CLIENT_ID\s*:\s*["']([^"']+)["']/,
    /BLOCKS_GITHUB_SSO_CLIENT_ID\s*=\s*["']([^"']+)["']/,
    /"BLOCKS_GITHUB_SSO_CLIENT_ID"\s*:\s*"([^"]+)"/
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1]?.trim();
    if (value && !value.includes("__BLOCKS_GITHUB_SSO_CLIENT_ID__")) return value;
  }
  return undefined;
}

export async function fetchGithubCredential(
  projectKey: string,
  flags: Flags
): Promise<CredentialResponse | undefined> {
  try {
    return await blocksRequest<CredentialResponse>(`${RELEASE_API}/Github/credential`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      ...requestContext(flags)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b404\b/.test(message)) return undefined;
    throw error;
  }
}

export async function getGithubConnection(projectKey: string, flags: Flags): Promise<GithubConnection> {
  const credential = await fetchGithubCredential(projectKey, flags);
  if (!credential?.token && !credential?.login) return { connected: false };
  return {
    connected: true,
    login: credential.login,
    scopes: [...GITHUB_CONNECT_SCOPES],
    tokenPresent: Boolean(credential.token)
  };
}

export type GithubConnectPollOptions = {
  onWait?: (seconds: number) => void;
  pollIntervalSeconds?: number;
  signal?: AbortSignal;
  timeoutSeconds?: number;
};

export async function pollGithubCredential(
  projectKey: string,
  flags: Flags,
  options: GithubConnectPollOptions = {}
): Promise<GithubConnection> {
  const intervalSeconds = Math.max(options.pollIntervalSeconds ?? GITHUB_CONNECT_POLL_INTERVAL_SECONDS, 1);
  const timeoutSeconds = Math.max(options.timeoutSeconds ?? GITHUB_CONNECT_DEFAULT_TIMEOUT_SECONDS, 1);
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) {
      throw new CliActionableError(
        "GitHub connect cancelled.",
        "github_connect_cancelled",
        "Re-run 'blocks github connect'; it will re-open the browser."
      );
    }

    const connection = await getGithubConnection(projectKey, flags);
    if (connection.connected) return connection;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const waitSeconds = Math.min(intervalSeconds, Math.max(1, Math.ceil(remainingMs / 1000)));
    options.onWait?.(waitSeconds);
    await delay(waitSeconds * 1000, options.signal);
  }

  throw new CliActionableError(
    "Timed out waiting for GitHub authorization.",
    "github_connect_timeout",
    "Re-run 'blocks github connect'; it will re-open the browser."
  );
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function installConnectAbortSignal(): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onSignal = (): void => controller.abort();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  return {
    signal: controller.signal,
    dispose: () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    }
  };
}
