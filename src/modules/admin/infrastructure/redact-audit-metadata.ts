import type { Prisma } from "@/generated/prisma/client";

import type { RedactedAuditMetadata } from "../application/admin-query-port";

const allowedKeys = new Set([
  "active",
  "allowStreaming",
  "changedFields",
  "count",
  "disabledAt",
  "endsAt",
  "failureCode",
  "issueCodes",
  "movieCount",
  "publishAt",
  "previousState",
  "reason",
  "revisionAfter",
  "revisionBefore",
  "role",
  "source",
  "startsAt",
  "state",
  "territory",
]);

function displayValue(value: Prisma.JsonValue): string | null {
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (value === null) {
    return "-";
  }
  if (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item === null ||
        typeof item === "string" ||
        typeof item === "boolean" ||
        typeof item === "number",
    )
  ) {
    return value.map((item) => String(item ?? "-")).join(", ");
  }
  return null;
}

export function redactAuditMetadata(value: Prisma.JsonValue): RedactedAuditMetadata {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return [];
  }
  return Object.entries(value)
    .filter(([key]) => allowedKeys.has(key))
    .flatMap(([key, entry]) => {
      if (entry === undefined) {
        return [];
      }
      const displayed = displayValue(entry);
      return displayed === null ? [] : [{ key, value: displayed }];
    })
    .sort((left, right) => left.key.localeCompare(right.key, "en"));
}
