export function hostFromAppDomain(appDomain: string): string {
  try {
    return new URL(appDomain).host;
  } catch {
    return appDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export function apiUrlFromAppDomain(appDomain: string): string {
  const hostname = hostFromAppDomain(appDomain).split(":")[0].toLowerCase();
  const labels = hostname.split(".").filter(Boolean);
  const registrableDomain = labels.length >= 2 ? labels.slice(-2).join(".") : hostname;
  return `https://blocksapi.${registrableDomain}`;
}

export function oidcRedirectUrisFromAppDomain(appDomain: string, devPort = 5173): string[] {
  const origin = appDomain.startsWith("http://") || appDomain.startsWith("https://")
    ? appDomain.replace(/\/+$/, "")
    : `https://${appDomain.replace(/\/+$/, "")}`;
  const local = new URL(origin);
  local.protocol = "https:";
  local.port = String(devPort);

  return [
    `${origin}/login/callback`,
    `${local.origin}/login/callback`
  ];
}
