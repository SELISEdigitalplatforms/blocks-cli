export function blocksOidcWellKnownUrl(oidcUrl: string, tenantId: string): string {
  return `${oidcUrl.replace(/\/$/, "")}/${tenantId}/.well-known/openid-configuration`;
}

export function withBlocksIdentityProviderDiscovery<T extends Record<string, unknown>>(body: T, oidcUrl: string, tenantId: string): T {
  if (body.registerAsIdentityProvider !== true || (typeof body.externalDiscoveryEndpoint === "string" && body.externalDiscoveryEndpoint)) {
    return body;
  }

  return {
    ...body,
    externalDiscoveryEndpoint: blocksOidcWellKnownUrl(oidcUrl, tenantId)
  };
}
