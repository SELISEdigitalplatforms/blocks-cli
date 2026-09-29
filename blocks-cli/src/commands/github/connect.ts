import { booleanFlag, integerFlag } from "../../lib/args.js";
import {
  GITHUB_CONNECT_DEFAULT_TIMEOUT_SECONDS,
  GITHUB_CONNECT_POLL_INTERVAL_SECONDS,
  GITHUB_CONNECT_SCOPES,
  buildGithubAuthorizeUrl,
  installConnectAbortSignal,
  newGithubOAuthState,
  pollGithubCredential,
  resolveGithubOauthClientId
} from "../../lib/github.js";
import { openBrowser } from "../../lib/open-browser.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function githubConnect(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const dryRun = booleanFlag(flags, "dry-run");
  const timeoutSeconds = integerFlag(flags, "timeout", GITHUB_CONNECT_DEFAULT_TIMEOUT_SECONDS);
  const progress = (message: string): void => (flags.json ? console.error(message) : console.log(message));

  const projectKey = await selectedProject(flags);
  const clientId = await resolveGithubOauthClientId(flags);
  const state = newGithubOAuthState();
  const authorizeUrl = buildGithubAuthorizeUrl(clientId, state);

  if (dryRun) {
    writeOutput(
      {
        authorizeUrl,
        dryRun: true,
        pollIntervalSeconds: GITHUB_CONNECT_POLL_INTERVAL_SECONDS,
        scopes: [...GITHUB_CONNECT_SCOPES],
        timeoutSeconds
      },
      flags
    );
    return;
  }

  progress("Connect GitHub to this Blocks account:");
  progress(`URL: ${authorizeUrl}`);
  const opened = await openBrowser(authorizeUrl);
  progress(
    opened
      ? "Opened your browser to authorize GitHub -- approve access, then return here."
      : "Browser auto-open is unavailable on this machine. Open the URL above manually."
  );
  progress("Waiting for approval...");

  const { signal, dispose } = installConnectAbortSignal();
  try {
    const connection = await pollGithubCredential(projectKey, flags, {
      onWait: (seconds) => progress(`Checking for approval in ${seconds}s...`),
      pollIntervalSeconds: GITHUB_CONNECT_POLL_INTERVAL_SECONDS,
      signal,
      timeoutSeconds
    });
    writeOutput(
      {
        connected: true,
        login: connection.login,
        scopes: [...GITHUB_CONNECT_SCOPES]
      },
      flags
    );
  } finally {
    dispose();
  }
}
