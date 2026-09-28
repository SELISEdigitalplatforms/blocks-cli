# Flow: What is already set up in this project

For "show me what's already there", "what's configured?", or any handover onto a project someone else built. **This flow is read-only. It runs no mutation, not even a dry run.** If a gap turns up, report it — do not quietly fix it.

Requires a selected project. If there is not one, do project selection first.

## The sweep

Run these in order. Every one is a read. Skip nothing silently: if a command fails or returns empty, that is a finding worth reporting, not a blank to omit.

```bash
# Identity of the project itself
blocks projects get --json

# Can anyone log into the app? (the usual reason someone asks)
blocks auth oidc-clients list --json
blocks auth idp list --json
blocks auth config get --json

# Who exists, and what can they do
blocks iam users list --page-size 5 --json  # use totalCount for the user total; this array is only a sample page
blocks iam roles list --json

# Data
blocks data config get --json
blocks data schema list --json

# Supporting services
blocks mail config list --json
blocks storage config list --json
blocks localization language list --json
blocks localization module list --json

# Has it ever shipped, only when the repo is unambiguous
blocks release builds list <repoId> --json
```

`blocks iam me --json` is worth adding when the user asks who *they* are. It prefers the impersonated project token when a project resolves and falls back to the account token only when no project resolves.

## Reading the login rows

This is where the answer usually lives, and three records have to agree before an end user can actually sign in:

- **An OIDC client**, and specifically a *public* one for a browser app. A confidential client stored for a SPA is a real misconfiguration, not a detail — its token endpoint auth method is derived from the client type, so a browser client saved without `public` is persisted as confidential.
- **An identity provider** registered against it. If a provider exists but its `authorizationUrl` is null, hosted login will not redirect — the browser gets sent to the app's own origin with OIDC parameters attached instead of to the login page. Report it; `blocks-iam-sso-oidc-configuration` owns the repair.
- **`isOidcEnabled: true`** in the auth config. All the client and provider records in the world do not produce a login screen while this is false.

`client_secret` is excluded from client list and get responses by design — you only ever see it once, at creation or rotation. If one does appear in any output, do not echo it into your summary.

`blocks release builds list` can prompt when more than one repo is linked. Do not let inventory fall into an interactive picker in an agent run. If you do not already have an unambiguous repo id, report Release as "repo not resolved" and hand off to `blocks-release-deployment` if the user wants deployment detail.

## Reporting it back

Give the user one table, not thirteen JSON blobs:

| Area | State |
|---|---|
| Project | name, environment, application domain |
| App login | public OIDC client? identity provider? `isOidcEnabled`? |
| Users & roles | user `totalCount` (never the sample array length), which roles exist |
| Data | data source configured? how many schemas |
| Services | mail, storage, localization languages |
| Releases | last build, or never deployed |

Then a short gap list, each line naming what fixes it:

- No public OIDC client, no identity provider, or `isOidcEnabled: false` → `blocks-iam-sso-oidc-configuration`
- No users → `blocks-iam-users`, and the first one needs a way to receive activation, which needs mail configured
- No mail configuration → `blocks-mail` (activation and password-reset mail silently goes nowhere without it)
- No data source or no schemas → `blocks-data-gateway-configuration`
- No storage configuration → `blocks-storage-configuration`
- No languages or modules → `blocks-localization-configuration`
- Never deployed → `blocks-release-deployment`

State plainly what you could not read. A command that errored is not the same as a feature that is absent, and reporting the two as one thing sends the user to fix something that may already work.

## Then

Ask what they want to do with it. Do not start the first gap on the list on your own initiative — a handover summary is the deliverable here, and which gap matters is their call, not yours.
