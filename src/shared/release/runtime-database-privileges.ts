export type RuntimeDatabasePrivilegeIssueCode =
  | "RUNTIME_IDENTITY_CAN_CREATE_SCHEMA_OBJECTS"
  | "RUNTIME_IDENTITY_OWNS_TABLES"
  | "RUNTIME_IDENTITY_SUPERUSER";

export type RuntimeDatabasePrivilegeSnapshot = Readonly<{
  canCreateSchemaObjects: boolean;
  ownedTableCount: number;
  superuser: boolean;
}>;

export type RuntimeDatabasePrivilegeDecision =
  | Readonly<{ ready: true }>
  | Readonly<{ issues: readonly RuntimeDatabasePrivilegeIssueCode[]; ready: false }>;

export function evaluateRuntimeDatabasePrivileges(
  snapshot: RuntimeDatabasePrivilegeSnapshot,
): RuntimeDatabasePrivilegeDecision {
  const issues: RuntimeDatabasePrivilegeIssueCode[] = [];
  if (snapshot.superuser) issues.push("RUNTIME_IDENTITY_SUPERUSER");
  if (snapshot.canCreateSchemaObjects) {
    issues.push("RUNTIME_IDENTITY_CAN_CREATE_SCHEMA_OBJECTS");
  }
  if (snapshot.ownedTableCount > 0) issues.push("RUNTIME_IDENTITY_OWNS_TABLES");
  return issues.length === 0 ? { ready: true } : { issues, ready: false };
}
