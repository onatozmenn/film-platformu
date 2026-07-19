import { describe, expect, it } from "vitest";

import {
  hasPlatformCapability,
  type PlatformCapability,
  type PlatformRole,
} from "./capability-policy";

const capabilities = [
  "MANAGE_OWN_LIBRARY",
  "VIEW_OWN_ACCOUNT",
  "EDIT_CATALOG",
  "PREVIEW_CATALOG",
  "PUBLISH_CATALOG",
  "MANAGE_ASSETS",
  "MANAGE_RIGHTS",
  "DISABLE_ACCOUNTS",
  "MANAGE_ROLES",
  "VIEW_AUDIT",
] as const satisfies readonly PlatformCapability[];

const cases = [
  ["visitor", [], []],
  ["member", ["MEMBER"], ["MANAGE_OWN_LIBRARY", "VIEW_OWN_ACCOUNT"]],
  [
    "editor",
    ["MEMBER", "EDITOR"],
    [
      "MANAGE_OWN_LIBRARY",
      "VIEW_OWN_ACCOUNT",
      "EDIT_CATALOG",
      "PREVIEW_CATALOG",
      "PUBLISH_CATALOG",
    ],
  ],
  ["admin", ["MEMBER", "ADMIN"], capabilities],
] as const satisfies readonly [string, readonly PlatformRole[], readonly PlatformCapability[]][];

describe("platform capability policy", () => {
  it.each(cases)("matches the %s authorization matrix", (_name, roles, allowed) => {
    const allowedCapabilities = new Set<PlatformCapability>(allowed);
    for (const capability of capabilities) {
      expect(hasPlatformCapability(roles, capability)).toBe(allowedCapabilities.has(capability));
    }
  });

  it("does not make EDITOR an implicit member but makes ADMIN an editor", () => {
    expect(hasPlatformCapability(["EDITOR"], "MANAGE_OWN_LIBRARY")).toBe(false);
    expect(hasPlatformCapability(["ADMIN"], "EDIT_CATALOG")).toBe(true);
    expect(hasPlatformCapability(["ADMIN"], "VIEW_AUDIT")).toBe(true);
  });
});
