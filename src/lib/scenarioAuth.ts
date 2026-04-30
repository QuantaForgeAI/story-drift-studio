import type { OrganizationMembershipRole } from "@/lib/scenarioBackendModels";

export type ScenarioWorkspacePermission =
  | "scenario.view"
  | "scenario.share"
  | "scenario.export"
  | "scenario.create"
  | "scenario.import"
  | "scenario.edit"
  | "scenario.delete"
  | "scenario.publish";

export const scenarioPermissionLabels: Record<
  ScenarioWorkspacePermission,
  string
> = {
  "scenario.view": "View",
  "scenario.share": "Share",
  "scenario.export": "Export",
  "scenario.create": "Create",
  "scenario.import": "Import",
  "scenario.edit": "Edit",
  "scenario.delete": "Delete",
  "scenario.publish": "Publish",
};

const rolePermissionMap: Record<
  OrganizationMembershipRole,
  readonly ScenarioWorkspacePermission[]
> = {
  owner: [
    "scenario.view",
    "scenario.share",
    "scenario.export",
    "scenario.create",
    "scenario.import",
    "scenario.edit",
    "scenario.delete",
    "scenario.publish",
  ],
  admin: [
    "scenario.view",
    "scenario.share",
    "scenario.export",
    "scenario.create",
    "scenario.import",
    "scenario.edit",
    "scenario.delete",
    "scenario.publish",
  ],
  editor: [
    "scenario.view",
    "scenario.share",
    "scenario.export",
    "scenario.create",
    "scenario.import",
    "scenario.edit",
    "scenario.delete",
  ],
  viewer: [
    "scenario.view",
    "scenario.share",
    "scenario.export",
  ],
};

export class ScenarioAuthorizationError extends Error {
  constructor(
    public permission: ScenarioWorkspacePermission,
    message?: string,
  ) {
    super(message ?? `Missing permission: ${permission}`);
    this.name = "ScenarioAuthorizationError";
  }
}

export function getPermissionsForRole(role: OrganizationMembershipRole) {
  return [...rolePermissionMap[role]];
}

export function hasScenarioPermission(
  roleOrPermissions:
    | OrganizationMembershipRole
    | readonly ScenarioWorkspacePermission[],
  permission: ScenarioWorkspacePermission,
) {
  const permissions = Array.isArray(roleOrPermissions)
    ? roleOrPermissions
    : rolePermissionMap[roleOrPermissions];

  return permissions.includes(permission);
}

export function assertScenarioPermission(
  roleOrPermissions:
    | OrganizationMembershipRole
    | readonly ScenarioWorkspacePermission[],
  permission: ScenarioWorkspacePermission,
  message?: string,
) {
  if (!hasScenarioPermission(roleOrPermissions, permission)) {
    throw new ScenarioAuthorizationError(permission, message);
  }
}

export function getMembershipRoleLabel(role: OrganizationMembershipRole) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
}

