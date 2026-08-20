import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type Flags = Record<string, string | boolean>;
type Query = Record<string, string | number | boolean | string[] | undefined>;

export async function dataFilesList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  await read("/data/v4/objects/get-objects", flags, compact({
    cursor: stringFlag(flags, "cursor") || undefined,
    limit: optionalIntegerFlag(flags, "limit"),
    moduleName: optionalIntegerFlag(flags, "module-name"),
    parentDirectoryId: parentId(flags) || undefined,
    search: stringFlag(flags, "search") || undefined,
    type: stringFlag(flags, "type") || undefined
  }));
}

export async function dataFilesSearch(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  await read("/data/v4/objects/search-objects", flags, compact({
    cursor: stringFlag(flags, "cursor") || undefined,
    directoryId: stringFlag(flags, "directory-id") || undefined,
    limit: optionalIntegerFlag(flags, "limit"),
    query: args[0] || stringFlag(flags, "query", { required: true }),
    type: stringFlag(flags, "type") || undefined
  }));
}

export async function dataFilesTrash(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  await read("/data/v4/objects/get-trash", flags, pageQuery(flags));
}

export async function dataFilesShared(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  await read("/data/v4/objects/get-shared-objects", flags, pageQuery(flags));
}

export async function dataFilesRestore(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const resourceId = resourceArg(args, flags);
  await mutate("/data/v4/objects/restore-from-trash", flags, { resourceId }, `Restore storage object '${resourceId}' from trash.`);
}

export async function dataFilesPurge(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const resourceId = resourceArg(args, flags);
  await mutate("/data/v4/objects/delete-from-trash", flags, { resourceId }, `Permanently delete storage object '${resourceId}' from trash.`);
}

export async function dataFilesDirectoryCreate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const base = await jsonBodyFlag(flags);
  const name = args[0] || stringFlag(flags, "name") || String(base.name ?? "");
  if (!name) throw new Error("Provide a directory name as the first argument or --name.");
  const body: Record<string, unknown> = { ...base, ...compact({
    allowedFileExtensions: listFlag(flags, "allowed-extensions"),
    configurationName: stringFlag(flags, "configuration-name") || undefined,
    description: stringFlag(flags, "description") || undefined,
    moduleName: optionalIntegerFlag(flags, "module-name"),
    name,
    parentDirectoryId: parentId(flags) || undefined
  }) };
  await mutate("/data/v4/directory/create-directory", flags, body, `Create storage directory '${name}'.`);
}

export async function dataFilesDirectoryGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const directoryId = directoryArg(args, flags);
  await read("/data/v4/directory/get-directory", flags, { directoryId });
}

export async function dataFilesDirectoryUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const directoryId = directoryArg(args, flags);
  const body = { ...(await jsonBodyFlag(flags)), ...compact({
    description: stringFlag(flags, "description") || undefined,
    directoryId,
    name: stringFlag(flags, "name") || undefined
  }) };
  await mutate("/data/v4/directory/update-directory", flags, body, `Update storage directory '${directoryId}'.`);
}

export async function dataFilesDirectoryDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const directoryId = directoryArg(args, flags);
  const permanent = booleanFlag(flags, "permanent");
  await mutate(
    "/data/v4/directory/delete-directory",
    flags,
    { directoryId, permanent },
    `${permanent ? "Permanently delete" : "Move"} storage directory '${directoryId}'${permanent ? "" : " to trash"}.`
  );
}

export async function dataFilesDirectoryMove(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const directoryId = directoryArg(args, flags);
  const targetDirectoryId = stringFlag(flags, "target-directory-id") || stringFlag(flags, "target-id");
  await mutate("/data/v4/directory/move-directory", flags, { directoryId, targetDirectoryId }, `Move storage directory '${directoryId}'.`);
}

export async function dataFilesVersions(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  await read("/data/v4/files/get-file-versions", flags, compact({
    cursor: stringFlag(flags, "cursor") || undefined,
    fileId: fileArg(args, flags),
    limit: optionalIntegerFlag(flags, "limit")
  }));
}

export async function dataFilesCreateVersion(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = fileArg(args, flags);
  await mutate("/data/v4/files/create-file-version", flags, compact({
    configurationName: stringFlag(flags, "configuration-name") || undefined,
    fileId
  }), `Create a new upload version for file '${fileId}'.`);
}

export async function dataFilesCopy(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = fileArg(args, flags);
  const targetDirectoryId = stringFlag(flags, "target-directory-id", { required: true });
  await mutate("/data/v4/files/copy-file", flags, {
    copyAccessPolicies: booleanFlag(flags, "copy-access-policies"), fileId, targetDirectoryId
  }, `Copy file '${fileId}' to directory '${targetDirectoryId}'.`);
}

export async function dataFilesMove(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = fileArg(args, flags);
  const targetDirectoryId = stringFlag(flags, "target-directory-id", { required: true });
  await mutate("/data/v4/files/move-file", flags, { fileId, targetDirectoryId }, `Move file '${fileId}' to directory '${targetDirectoryId}'.`);
}

export async function dataFilesRename(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = fileArg(args, flags);
  const name = stringFlag(flags, "name", { required: true });
  await mutate("/data/v4/files/rename-file", flags, { fileId, name }, `Rename file '${fileId}' to '${name}'.`);
}

export async function dataFilesAccessList(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  await read("/data/v4/objects/get-access-policies", flags, { resourceId: resourceArg(args, flags) });
}

export async function dataFilesAccessGrant(argv: string[]): Promise<void> {
  await accessMutation(argv, "/data/v4/objects/grant-access", "Grant access to");
}

export async function dataFilesAccessUpdate(argv: string[]): Promise<void> {
  await accessMutation(argv, "/data/v4/objects/update-access-policy", "Update access on", true);
}

export async function dataFilesAccessRevoke(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const resourceId = resourceArg(args, flags);
  const policyItemId = stringFlag(flags, "policy-id", { required: true });
  await mutate("/data/v4/objects/revoke-access-policy", flags, { policyItemId, resourceId }, `Revoke access policy '${policyItemId}' from '${resourceId}'.`);
}

export async function dataFilesAccessResolve(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  await read("/data/v4/objects/resolve-access", flags, { resourceId: resourceArg(args, flags) });
}

export async function dataFilesInheritance(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const base = await jsonBodyFlag(flags);
  const value = optionalBooleanFlag(flags, "enabled");
  const inheritsParentAccess = value ?? base.inheritsParentAccess;
  if (typeof inheritsParentAccess !== "boolean") throw new Error("Provide --enabled=true|false.");
  const resourceId = resourceArg(args, flags, base);
  await mutate("/data/v4/objects/toggle-inheritance", flags, { ...base, inheritsParentAccess, resourceId }, `Set inheritance on '${resourceId}' to ${inheritsParentAccess}.`);
}

export async function dataFilesShare(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const base = await jsonBodyFlag(flags);
  const resourceId = resourceArg(args, flags, base);
  const body = accessBody(base, flags, resourceId);
  delete body.effect;
  delete body.policyItemId;
  await mutate("/data/v4/objects/share-object", flags, body, `Share storage object '${resourceId}'.`);
}

async function accessMutation(argv: string[], endpoint: string, action: string, update = false): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const base = await jsonBodyFlag(flags);
  const resourceId = resourceArg(args, flags, base);
  const body = accessBody(base, flags, resourceId);
  if (update && !body.policyItemId) throw new Error("Provide --policy-id when updating an access policy.");
  await mutate(endpoint, flags, body, `${action} storage object '${resourceId}'.`);
}

function accessBody(base: Record<string, unknown>, flags: Flags, resourceId: string): Record<string, unknown> {
  const body: Record<string, unknown> = { ...base, ...compact({
    effect: stringFlag(flags, "effect") || undefined,
    expiresAt: stringFlag(flags, "expires-at") || undefined,
    permission: stringFlag(flags, "permission") || undefined,
    policyItemId: stringFlag(flags, "policy-id") || undefined,
    principalId: stringFlag(flags, "principal-id") || undefined,
    principalType: stringFlag(flags, "principal-type") || undefined,
    priority: optionalIntegerFlag(flags, "priority"),
    resourceId,
    resourceType: stringFlag(flags, "resource-type") || undefined
  }) };
  for (const field of ["permission", "principalType", "resourceType"]) {
    if (!body[field]) throw new Error(`Provide --${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.`);
  }
  return body;
}

async function read(endpoint: string, flags: Flags, query: Query): Promise<void> {
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(endpoint, {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query
  });
  writeOutput(result, flags);
}

async function mutate(endpoint: string, flags: Flags, body: Record<string, unknown>, prompt: string): Promise<void> {
  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint, request: body }, flags);
    return;
  }
  await confirmMutation(flags, prompt);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(endpoint, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function pageQuery(flags: Flags): Query {
  return compact({
    cursor: stringFlag(flags, "cursor") || undefined,
    limit: optionalIntegerFlag(flags, "limit"),
    type: stringFlag(flags, "type") || undefined
  });
}

function parentId(flags: Flags): string {
  return stringFlag(flags, "parent-directory-id") || stringFlag(flags, "parent-id");
}

function resourceArg(args: string[], flags: Flags, base: Record<string, unknown> = {}): string {
  const value = args[0] || stringFlag(flags, "resource-id") || String(base.resourceId ?? "");
  if (!value) throw new Error("Provide a resource id as the first argument or --resource-id.");
  return value;
}

function directoryArg(args: string[], flags: Flags): string {
  return args[0] || stringFlag(flags, "directory-id", { required: true });
}

function fileArg(args: string[], flags: Flags): string {
  return args[0] || stringFlag(flags, "file-id", { required: true });
}
