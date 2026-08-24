# Object management

Use `blocks data files *` from a terminal and `blocksClient.data.directories` / `blocksClient.data.objects` / `blocksClient.data.files` in app code. Do not fall back to legacy `data.dms.*` helpers or raw HTTP.

## Browse a directory

Use the current `get-objects` operation with:

- `parentDirectoryId` for a concrete directory, or `moduleName` to resolve a module's default directory when no parent id is supplied.
- `cursor` from the previous response and `limit` from 1–200 (default 50).
- `type: "directory" | "file"` to narrow results.
- `search` for name filtering within that parent.

The result contains `items`, `nextCursor`, `hasMore`, and `totalChildCount`. Each item has a lowercase `type` discriminator and permission flags. Continue while `hasMore` using `nextCursor`; access filtering can produce a short page even when more results remain.

Use `search-objects` for a case-insensitive name search across descendants. Pass `query`, optional `directoryId`, optional type, cursor, and limit. Search text is treated literally rather than as a regular expression.

```bash
blocks data files list --parent-id <directoryId> --type file --limit 50 --json
blocks data files search invoice --directory-id <directoryId> --json
```

```ts
const page = await blocksClient.data.objects.list({ parentDirectoryId, limit: 50 });
const matches = await blocksClient.data.objects.search({ query: "invoice", directoryId });
```

## Manage directories

- **Create:** provide `name`, an existing `parentDirectoryId`, optional `description`, `configurationName`, and `allowedFileExtensions`. If the parent is empty but `moduleName` is present, the backend resolves the module default. Creating a true root uses a separate owner-only capability and should not be a normal app action.
- **Read details:** get one directory by `directoryId`. The response includes path, ancestors, child counts, size, extension rules, inheritance, timestamps, and permissions.
- **Update:** provide `directoryId` and optional `name`/`description`. Default directories cannot be renamed.
- **Move:** provide `directoryId` and `targetDirectoryId`; an empty target means top level. Moving into self/descendants is rejected. Default directories cannot move.
- **Delete:** send `permanent: false` for trash. Permanent deletion requires an empty directory. Default directories cannot be deleted.

Directory names must be 1–255 characters, trimmed, not `.`/`..`, and contain no slash or backslash. Descriptions are limited to 2,000 characters.

```bash
blocks data files directory-create Contracts --parent-id <directoryId> \
  --allowed-extensions pdf,docx --dry-run --json
blocks data files directory-get <directoryId> --json
blocks data files directory-update <directoryId> --name Agreements --dry-run --json
blocks data files directory-move <directoryId> --target-directory-id <targetId> --dry-run --json
blocks data files directory-delete <directoryId> --dry-run --json
```

Use the matching `blocksClient.data.directories.create/get/update/move/delete` methods in app code.

## Manage files

- **Rename:** needs Edit and a unique name in the current directory.
- **Move:** needs Delete on the source file and Edit on the target directory. Stored bytes and versions stay in place.
- **Copy:** needs View on the source and Edit on the target. The new file gets a new id; version rows reference the same immutable stored bytes. It inherits from the target. Set `copyAccessPolicies` only when the user intends to duplicate direct policy entries.
- **Versions:** list newest-first with a cursor and limit 1–100. Creating a cloud version returns `versionNo` and `uploadUrl`; PUT the bytes to that URL without Blocks auth headers.

Move/copy reject a target name collision and a file extension disallowed by the target directory.

```bash
blocks data files rename <fileId> --name final.pdf --dry-run --json
blocks data files move <fileId> --target-directory-id <targetId> --dry-run --json
blocks data files copy <fileId> --target-directory-id <targetId> --dry-run --json
```

Use `blocksClient.data.files.rename`, `.move`, and `.copy` in app code.

## Trash and restore

Use soft delete (`permanent: false`) to archive an item. List archived files/directories with `get-trash`, optionally filtering by type and paging with cursor/limit. Restore with `restore-from-trash`; permanently purge an archived item with `delete-from-trash` only after explicit approval.

Restore returns the item to its original parent. Reads and mutations remain ACL-filtered while the item is archived.

```bash
blocks data files trash --type file --json
blocks data files restore <resourceId> --dry-run --json
blocks data files purge <resourceId> --dry-run --json
```

Use `blocksClient.data.objects.trash`, `.restore`, and `.deleteFromTrash` in app code.

## Shared objects

Use `get-shared-objects` for live items shared with the caller. It is cursor-paginated and may be filtered by `directory`/`file`. Owned objects are excluded. Direct or inherited allow entries for the current user, role, or organization qualify as shares.

Use `share-object` for the common allow-only action. Provide:

- `resourceId`
- `resourceType`: `Directory` or `File`
- `principalType`: `User`, `Role`, `Organization`, or `Everyone`
- `principalId` for every type except `Everyone`
- `permission`: `View`, `Download`, `Edit`, `Delete`, `Manage`, or `Owner`
- optional future `expiresAt`

Sharing requires Manage on the resource.

```bash
blocks data files shared --json
blocks data files share <resourceId> --resource-type Directory \
  --principal-type Role --principal-id editors --permission Edit --dry-run --json
```

Use `blocksClient.data.objects.shared` and `.share` in app code.

## Advanced access policies

Use the policy operations only for an access-management UI:

- `get-access-policies` lists direct entries on a resource.
- `grant-access` adds Allow or Deny with optional priority and expiry.
- `update-access-policy` replaces an entry and requires its `policyItemId`.
- `revoke-access-policy` removes an entry by `resourceId` and `policyItemId`.
- `resolve-access` returns the caller's `canView`, `canDownload`, `canEdit`, `canDelete`, `canManage`, and `canOwner` flags.
- `toggle-inheritance` changes whether ancestors participate in resolution.

Enums are JSON strings, not guessed numeric values. Priority must be non-negative and expiry must be in the future.

Policy guardrails:

- Manage is required to change access.
- A Deny aimed at the resource owner is rejected.
- Turning inheritance off is rejected until the resource has a direct Allow entry, preventing an orphaned resource.
- The request model for access-policy listing contains `includeInherited`, but the current controller does not use it; do not promise inherited entries in that response. Use `resolve-access` for effective permissions.
- Object reads may return 404 instead of 403 to avoid revealing hidden ids.

CLI access commands are `access-list`, `access-grant`, `access-update`, `access-revoke`, `access-resolve`, and `inheritance`. Their SDK equivalents are under `blocksClient.data.objects`.
