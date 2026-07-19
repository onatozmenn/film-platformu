export type PlatformRole = "ADMIN" | "EDITOR" | "MEMBER";

export type PlatformCapability =
  | "DISABLE_ACCOUNTS"
  | "EDIT_CATALOG"
  | "MANAGE_ASSETS"
  | "MANAGE_OWN_LIBRARY"
  | "MANAGE_RIGHTS"
  | "MANAGE_ROLES"
  | "PREVIEW_CATALOG"
  | "PUBLISH_CATALOG"
  | "VIEW_AUDIT"
  | "VIEW_OWN_ACCOUNT";

const memberCapabilities = new Set<PlatformCapability>(["MANAGE_OWN_LIBRARY", "VIEW_OWN_ACCOUNT"]);
const editorCapabilities = new Set<PlatformCapability>([
  "EDIT_CATALOG",
  "PREVIEW_CATALOG",
  "PUBLISH_CATALOG",
]);
const adminCapabilities = new Set<PlatformCapability>([
  "DISABLE_ACCOUNTS",
  "MANAGE_ASSETS",
  "MANAGE_RIGHTS",
  "MANAGE_ROLES",
  "VIEW_AUDIT",
]);

export function hasPlatformCapability(
  roles: readonly PlatformRole[],
  capability: PlatformCapability,
): boolean {
  const assignedRoles = new Set(roles);

  if (memberCapabilities.has(capability)) {
    return assignedRoles.has("MEMBER");
  }
  if (editorCapabilities.has(capability)) {
    return assignedRoles.has("EDITOR") || assignedRoles.has("ADMIN");
  }

  return adminCapabilities.has(capability) && assignedRoles.has("ADMIN");
}
