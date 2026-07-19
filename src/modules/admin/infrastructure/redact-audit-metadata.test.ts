import { describe, expect, it } from "vitest";

import { redactAuditMetadata } from "./redact-audit-metadata";

describe("audit metadata redaction", () => {
  it("keeps only allowlisted scalar and scalar-list facts in stable key order", () => {
    expect(
      redactAuditMetadata({
        active: true,
        email: "private@film-platform.invalid",
        issueCodes: ["RIGHTS_UNAVAILABLE", null, 2, false],
        nested: { token: "private" },
        revisionAfter: 2,
        source: "MANUAL",
      }),
    ).toEqual([
      { key: "active", value: "true" },
      { key: "issueCodes", value: "RIGHTS_UNAVAILABLE, -, 2, false" },
      { key: "revisionAfter", value: "2" },
      { key: "source", value: "MANUAL" },
    ]);
  });

  it.each([null, [], "text", 42])("rejects a non-object root %#", (value) => {
    expect(redactAuditMetadata(value)).toEqual([]);
  });

  it("omits arrays containing structured values and displays allowlisted null", () => {
    expect(
      redactAuditMetadata({
        changedFields: [{ secret: true }],
        reason: null,
      }),
    ).toEqual([{ key: "reason", value: "-" }]);
  });
});
