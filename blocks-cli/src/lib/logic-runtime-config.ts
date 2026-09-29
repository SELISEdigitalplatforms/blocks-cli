import { readConfig, resolveAccountProfile } from "./config.js";
import { CliActionableError } from "./errors.js";

type Flags = Record<string, string | boolean>;

export type LogicRuntimeConfig = {
  agentsBaseUrl?: string;
  dataBaseUrl?: string;
};

/**
 * Resolve BLOCKS_AGENTS_BASE_URL / BLOCKS_DATA_BASE_URL from env overrides or
 * by scraping blocks-logic's public index.html (window.__BLOCKS_ENV__), same
 * pattern as github.ts for BLOCKS_GITHUB_SSO_CLIENT_ID (A7).
 */
export async function resolveLogicRuntimeConfig(
  flags: Flags,
  needed: { agents: boolean; data: boolean }
): Promise<LogicRuntimeConfig> {
  if (!needed.agents && !needed.data) return {};

  const fromEnv: LogicRuntimeConfig = {
    agentsBaseUrl: cleanEnv(process.env.BLOCKS_AGENTS_BASE_URL),
    dataBaseUrl: cleanEnv(process.env.BLOCKS_DATA_BASE_URL)
  };

  const stillNeedAgents = needed.agents && !fromEnv.agentsBaseUrl;
  const stillNeedData = needed.data && !fromEnv.dataBaseUrl;
  if (!stillNeedAgents && !stillNeedData) return fromEnv;

  const candidates = await logicWebCandidateUrls(flags);
  const scraped: LogicRuntimeConfig = {};
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const html = await fetchHtml(candidate);
      const agents = parseEnvFromHtml(html, "BLOCKS_AGENTS_BASE_URL");
      const data = parseEnvFromHtml(html, "BLOCKS_DATA_BASE_URL");
      if (agents) scraped.agentsBaseUrl = scraped.agentsBaseUrl ?? agents;
      if (data) scraped.dataBaseUrl = scraped.dataBaseUrl ?? data;
      if ((!stillNeedAgents || scraped.agentsBaseUrl) && (!stillNeedData || scraped.dataBaseUrl)) {
        break;
      }
      errors.push(`${candidate}: missing ${[
        stillNeedAgents && !scraped.agentsBaseUrl ? "BLOCKS_AGENTS_BASE_URL" : "",
        stillNeedData && !scraped.dataBaseUrl ? "BLOCKS_DATA_BASE_URL" : ""
      ].filter(Boolean).join(", ")}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }

  const result: LogicRuntimeConfig = {
    agentsBaseUrl: fromEnv.agentsBaseUrl ?? scraped.agentsBaseUrl,
    dataBaseUrl: fromEnv.dataBaseUrl ?? scraped.dataBaseUrl
  };

  if (needed.agents && !result.agentsBaseUrl) {
    throw new CliActionableError(
      "Could not resolve blocks-logic's BLOCKS_AGENTS_BASE_URL for an 'agent' node.",
      "logic_runtime_config_unavailable",
      errors.length
        ? `Tried: ${errors.join("; ")}. Set BLOCKS_AGENTS_BASE_URL or BLOCKS_LOGIC_WEB_URL and re-run.`
        : "Set BLOCKS_AGENTS_BASE_URL or BLOCKS_LOGIC_WEB_URL and re-run."
    );
  }
  if (needed.data && !result.dataBaseUrl) {
    throw new CliActionableError(
      "Could not resolve blocks-logic's BLOCKS_DATA_BASE_URL for a 'dataAction' node.",
      "logic_runtime_config_unavailable",
      errors.length
        ? `Tried: ${errors.join("; ")}. Set BLOCKS_DATA_BASE_URL or BLOCKS_LOGIC_WEB_URL and re-run.`
        : "Set BLOCKS_DATA_BASE_URL or BLOCKS_LOGIC_WEB_URL and re-run."
    );
  }

  return result;
}

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("__BLOCKS_")) return undefined;
  return trimmed.replace(/\/+$/, "");
}

async function logicWebCandidateUrls(flags: Flags): Promise<string[]> {
  const urls: string[] = [];
  const logicWeb = (process.env.BLOCKS_LOGIC_WEB_URL ?? "").trim().replace(/\/+$/, "");
  if (logicWeb) urls.push(logicWeb, `${logicWeb}/`, `${logicWeb}/index.html`);

  const config = await readConfig();
  const { profile } = await resolveAccountProfile(
    config,
    typeof flags.account === "string" ? flags.account : undefined
  );
  const apiUrl = (
    typeof flags["api-url"] === "string" && flags["api-url"] ? flags["api-url"] : profile.apiUrl
  ).replace(/\/+$/, "");

  try {
    const parsed = new URL(apiUrl);
    const host = parsed.hostname;
    const rewritten = host
      .replace(/^api\./i, "logic.")
      .replace(/^blocksapi\./i, "logic.")
      .replace(/^dev-api-/i, "dev-logic-")
      .replace(/^stg-api-/i, "stg-logic-");
    if (rewritten !== host) {
      const origin = `${parsed.protocol}//${rewritten}${parsed.port ? `:${parsed.port}` : ""}`;
      urls.push(origin, `${origin}/`, `${origin}/index.html`);
    }
  } catch {
    // ignore
  }

  // Also try the API origin itself (some envs serve the SPA there).
  urls.push(apiUrl, `${apiUrl}/`, `${apiUrl}/index.html`);
  return [...new Set(urls)];
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml,application/json" },
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const ENV_HTML_PATTERNS: Record<string, RegExp[]> = {
  BLOCKS_AGENTS_BASE_URL: [
    /BLOCKS_AGENTS_BASE_URL\s*:\s*["']([^"']+)["']/,
    /BLOCKS_AGENTS_BASE_URL\s*=\s*["']([^"']+)["']/,
    /"BLOCKS_AGENTS_BASE_URL"\s*:\s*"([^"]+)"/
  ],
  BLOCKS_DATA_BASE_URL: [
    /BLOCKS_DATA_BASE_URL\s*:\s*["']([^"']+)["']/,
    /BLOCKS_DATA_BASE_URL\s*=\s*["']([^"']+)["']/,
    /"BLOCKS_DATA_BASE_URL"\s*:\s*"([^"]+)"/
  ]
};

export function parseEnvFromHtml(html: string, key: string): string | undefined {
  const patterns = ENV_HTML_PATTERNS[key];
  if (!patterns) return undefined;
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1]?.trim();
    if (value && !value.includes(`__${key}__`) && !value.includes("__BLOCKS_")) {
      return value.replace(/\/+$/, "");
    }
  }
  return undefined;
}
