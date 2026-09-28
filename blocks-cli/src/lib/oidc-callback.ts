import { blocksRequest } from "./api.js";
import { confirmMutation } from "./confirm.js";
import { isRecord } from "./data-response.js";
import { carryOidcClient, readOidcClient } from "./oidc-client.js";
import { listReleaseRepos, repoIdOf } from "./release.js";
import { readCurrentSecrets } from "./release-secrets.js";
import { requestContext } from "./request-context.js";

type Flags = Record<string, string | boolean>;

/**
 * Closes the fresh-deployment login gap: 'release setup' assigns the repo a
 * random-suffixed domain (<project>-<random>.slsblx.com), but nothing registered
 * that origin's /login/callback on the project's OIDC client, so the FIRST login on
 * a new deployment failed with redirect_uri_not_registered. After a deploy/domain
 * change this checks the project's OIDC clients for the deployed callback and either
 * registers it (--register-callback, merged save + re-read verify) or prints the
 * exact fix.
 *
 * The check reads the CLIENT LIST, not the repo's secrets: RepoSecret/value returns
 * the plaintext set and is audited server-side on every call, which is no way to
 * decorate every deploy. Secrets are read only to disambiguate WHICH client is the
 * app's (its *OIDC_CLIENT_ID key, e.g. VITE_BLOCKS_OIDC_CLIENT_ID) -- and only when
 * several clients exist and none has the callback.
 *
 * Advisory by design: everything goes to stderr (stdout stays one --json document),
 * and no failure here ever fails the deploy that just succeeded -- a project with no
 * OIDC clients, or an unreadable list, simply ends the check.
 */
export async function checkDeployedOidcCallback(
  repoId: string,
  projectKey: string,
  flags: Flags,
  options: { register: boolean }
): Promise<void> {
  try {
    await runCheck(repoId, projectKey, flags, options);
  } catch (error) {
    console.error(`Warning: could not verify the OIDC redirect URI for this deployment (${(error as Error).message}).`);
  }
}

async function runCheck(repoId: string, projectKey: string, flags: Flags, options: { register: boolean }): Promise<void> {
  const repo = (await listReleaseRepos(projectKey, flags)).find((candidate) => repoIdOf(candidate) === repoId);
  const url = repo?.customDeploymentUrl || repo?.defaultDeploymentUrl;
  if (!url) return; // no ingress URL assigned (yet) -- nothing to register

  const clients = await listOidcClients(projectKey, flags);
  if (clients.length === 0) return; // no OIDC app in this project

  const callback = `${url.replace(/\/+$/, "")}/login/callback`;
  if (clients.some((client) => redirectUrisOf(client).some((uri) => uri.toLowerCase() === callback.toLowerCase()))) {
    return; // registered -- stay quiet
  }

  const client = clients.length === 1 ? clients[0] : await pickClientFromRepoSecrets(clients, repoId, projectKey, flags);
  const clientId = typeof client?.itemId === "string" ? client.itemId : typeof client?.clientId === "string" ? client.clientId : undefined;
  if (!client || !clientId) {
    console.error(
      `Warning: '${callback}' is not registered on any of this project's ${clients.length} OIDC clients -- the first login on ${url} will fail with redirect_uri_not_registered. Pick the app's client from 'blocks auth oidc-clients list --json' and append it with 'blocks auth oidc-clients save --item-id <id> --redirect-uris "<current list>,${callback}" --yes'.`
    );
    return;
  }

  const redirectUris = redirectUrisOf(client);
  if (!options.register) {
    console.error(
      [
        `Warning: '${callback}' is not among OIDC client '${clientId}'s redirect URIs -- the first login on ${url} will fail with redirect_uri_not_registered.`,
        `Fix: re-run with --register-callback, or run:`,
        `  blocks auth oidc-clients save --item-id ${clientId} --redirect-uris "${[...redirectUris, callback].join(",")}" --yes --json`
      ].join("\n")
    );
    return;
  }

  await confirmMutation(flags, `Register '${callback}' on OIDC client '${clientId}' (its other settings are kept).`);
  await blocksRequest<unknown>("/iam/v4/oidc-clients", {
    body: { ...carryOidcClient(client), itemId: clientId, redirectUris: [...redirectUris, callback] },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });

  const saved = await readOidcClient(clientId, projectKey, flags);
  if (redirectUrisOf(saved).some((uri) => uri.toLowerCase() === callback.toLowerCase())) {
    console.error(`Registered '${callback}' on OIDC client '${clientId}' (verified by re-reading the client).`);
  } else {
    console.error(
      `Warning: saved OIDC client '${clientId}' but the re-read does not show '${callback}' -- verify with 'blocks auth oidc-clients get ${clientId} --json'.`
    );
  }
}

async function listOidcClients(projectKey: string, flags: Flags): Promise<Record<string, unknown>[]> {
  const response = await blocksRequest<unknown>("/iam/v4/oidc-clients", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];
  const nested = response.oIDCClientCredentials ?? response.oidcClientCredentials;
  return Array.isArray(nested) ? nested.filter(isRecord) : [];
}

/** The audited plaintext-secret read, taken only when several clients leave the app's one ambiguous. */
async function pickClientFromRepoSecrets(
  clients: Record<string, unknown>[],
  repoId: string,
  projectKey: string,
  flags: Flags
): Promise<Record<string, unknown> | undefined> {
  const secrets = await readCurrentSecrets(repoId, projectKey, flags);
  const wanted = Object.entries(secrets).find(([key, value]) => /OIDC_CLIENT_ID$/i.test(key) && value)?.[1];
  if (!wanted) return undefined;
  return clients.find((client) => client.itemId === wanted || client.clientId === wanted);
}

function redirectUrisOf(client: Record<string, unknown> | undefined): string[] {
  return Array.isArray(client?.redirectUris) ? client.redirectUris.filter((uri): uri is string => typeof uri === "string") : [];
}
