import { getAccountSession, getImpersonatedProjectSession } from "./auth.js";
import { getAccountProfile, readConfig } from "./config.js";

type RequestOptions = {
  accountAuth?: boolean;
  accountName?: string;
  apiUrl?: string;
  body?: unknown;
  impersonatedProjectAuth?: boolean;
  method?: string;
  projectTenantId?: string;
  query?: Record<string, string | number | boolean | string[] | undefined>;
};

export async function blocksRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = await readConfig();
  const { profile } = getAccountProfile(config, options.accountName);
  const baseUrl = options.apiUrl ?? profile.apiUrl;
  const url = buildUrl(baseUrl, path);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  if (options.accountAuth) {
    const account = await getAccountSession(options.accountName);
    headers.Authorization = `Bearer ${account.accessToken}`;
    headers["x-blocks-key"] = account.accountTenant;
  }

  if (options.impersonatedProjectAuth) {
    const project = await getImpersonatedProjectSession(options.accountName, options.projectTenantId);
    headers.Authorization = `Bearer ${project.accessToken}`;
    headers["x-blocks-key"] = project.accountTenant;
  }

  const response = await fetch(url, {
    body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
    headers,
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  }).catch((error: Error) => {
    throw new Error(`Blocks API request failed for ${url.origin}${url.pathname}: ${error.message}`);
  });

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const detail = errorDetail(data);
    throw new Error(`Blocks API ${response.status} ${response.statusText}${detail}`);
  }

  if (typeof data === "string" && looksLikeHtml(data)) {
    throw new Error(`Blocks API returned HTML for ${url.pathname}. Check the command endpoint path.`);
  }

  return data as T;
}

function buildUrl(baseUrl: string, path: string): URL {
  if (/^https?:\/\//i.test(path)) return new URL(path);
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBase);
}

function errorDetail(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return `: ${data}`;
  if (typeof data !== "object") return `: ${String(data)}`;

  const record = data as Record<string, unknown>;
  for (const key of ["detail", "message", "error_description", "error", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value) return `: ${value}`;
  }

  return `: ${JSON.stringify(data)}`;
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text);
}

function parseJson(text: string): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
