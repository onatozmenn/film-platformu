import { describe, expect, it } from "vitest";

import {
  evaluateRuntimeDatabasePrivileges,
  type RuntimeDatabasePrivilegeIssueCode,
  type RuntimeDatabasePrivilegeSnapshot,
} from "./runtime-database-privileges";

const leastPrivilege: RuntimeDatabasePrivilegeSnapshot = {
  canCreateSchemaObjects: false,
  ownedTableCount: 0,
  superuser: false,
};

describe("runtime database privilege policy", () => {
  it("accepts a runtime identity without schema-changing authority", () => {
    expect(evaluateRuntimeDatabasePrivileges(leastPrivilege)).toEqual({ ready: true });
  });

  it.each([
    ["RUNTIME_IDENTITY_SUPERUSER", { superuser: true }],
    ["RUNTIME_IDENTITY_CAN_CREATE_SCHEMA_OBJECTS", { canCreateSchemaObjects: true }],
    ["RUNTIME_IDENTITY_OWNS_TABLES", { ownedTableCount: 1 }],
  ] as const satisfies readonly (readonly [
    RuntimeDatabasePrivilegeIssueCode,
    Partial<RuntimeDatabasePrivilegeSnapshot>,
  ])[])("returns %s for an overprivileged runtime identity", (issue, override) => {
    expect(evaluateRuntimeDatabasePrivileges({ ...leastPrivilege, ...override })).toEqual({
      issues: [issue],
      ready: false,
    });
  });
});
