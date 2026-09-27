import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent, findInList } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

// Fixed once a configuration exists: Storage/Save discards them on every save that
// resolves to a stored record and still answers success.
const PROVIDER_FIELDS = [
  "accessKey", "cloudStorageRegionEndPoint", "connectionString", "host", "password",
  "port", "remoteBasePath", "secretKey", "storageStrategy", "userName"
];

// The only fields a save to an existing record writes -- and it writes all four from the
// request, so one left out is reset to blocks-data's default rather than kept.
const UPLOAD_SECURITY_FIELDS = [
  "uploadUrlExpirySeconds", "downloadUrlExpirySeconds", "maxFileSizeInBytes", "uploadCompletionRequiredFor"
];

export async function storageConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  // Presence, not value: `--upload-completion-required-for=` (empty) clears the list, while
  // leaving the flag out keeps what is stored.
  const completionFor = "upload-completion-required-for" in flags ? stringFlag(flags, "upload-completion-required-for") : undefined;
  const overrides: Record<string, unknown> = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accessKey: stringFlag(flags, "access-key") || undefined,
      cloudStorageRegionEndPoint: stringFlag(flags, "region-endpoint") || undefined,
      connectionString: stringFlag(flags, "connection-string") || undefined,
      downloadUrlExpirySeconds: optionalIntegerFlag(flags, "download-url-expiry-seconds"),
      host: stringFlag(flags, "host") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      maxFileSizeInBytes: optionalIntegerFlag(flags, "max-file-size-bytes"),
      name: stringFlag(flags, "name") || undefined,
      password: stringFlag(flags, "password") || undefined,
      port: stringFlag(flags, "port") || undefined,
      remoteBasePath: stringFlag(flags, "remote-base-path") || undefined,
      secretKey: stringFlag(flags, "secret-key") || undefined,
      storageStrategy: stringFlag(flags, "strategy") || undefined,
      updateRequest: optionalBooleanFlag(flags, "update"),
      uploadCompletionRequiredFor: completionFor === undefined
        ? undefined
        : completionFor.split(",").map((value) => value.trim()).filter(Boolean),
      uploadUrlExpirySeconds: optionalIntegerFlag(flags, "upload-url-expiry-seconds"),
      userName: stringFlag(flags, "username") || undefined
    })
  };

  const isUpdate = overrides.updateRequest === true;
  const existing = isUpdate ? await findConfiguration(flags, (item) => item.itemId === overrides.itemId) : undefined;

  if (isUpdate && !existing) {
    throw new Error(`No storage configuration with --item-id '${String(overrides.itemId ?? "")}'. Run 'blocks storage config list'.`);
  }

  if (existing) {
    const ignored = PROVIDER_FIELDS.filter((field) => overrides[field] !== undefined);
    if (ignored.length > 0) {
      throw new Error(
        `Storage configuration '${String(existing.name ?? existing.itemId)}' already exists, and its provider and credentials are fixed: ` +
          `the server would drop ${ignored.join(", ")} and report success. Only the upload settings can change ` +
          "(--upload-url-expiry-seconds, --download-url-expiry-seconds, --max-file-size-bytes, --upload-completion-required-for). " +
          "To change the provider, delete the configuration and create it again."
      );
    }
  }

  const body = existing
    ? { ...carryCurrent(existing, UPLOAD_SECURITY_FIELDS), ...overrides, itemId: existing.itemId, updateRequest: true }
    : overrides;

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint: "/os/v4/Storage/Save",
        request: redactSecrets(body, ["secretkey"]),
        target: existing ? "update" : "create"
      },
      flags
    );
    return;
  }

  // A create whose name is already taken is saved by the server as an update of that
  // record -- dropping the provider fields and resetting any upload setting not passed --
  // so it is refused here. Checked on the live run only, keeping a create's dry-run offline.
  if (!existing && typeof body.name === "string") {
    const taken = await findConfiguration(flags, (item) => item.name === body.name);
    if (taken) {
      throw new Error(
        `A storage configuration named '${body.name}' already exists. To change its upload settings, pass --update --item-id ${String(taken.itemId)}.`
      );
    }
  }

  await confirmMutation(flags, `Save storage configuration '${String(body.name ?? body.itemId ?? "")}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Storage/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

async function findConfiguration(
  flags: Record<string, string | boolean>,
  predicate: (item: Record<string, unknown>) => boolean
): Promise<Record<string, unknown> | undefined> {
  return findInList(
    await blocksRequest<unknown>("/os/v4/Storage/Gets", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: await selectedProject(flags)
    }),
    predicate
  );
}
