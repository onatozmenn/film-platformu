const redacted = "[REDACTED]";
const sensitiveKey =
  /authorization|cookie|credential|database.?url|email|password|private.?key|secret|signed.?url|tag.?url|token/i;

function isLogRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown, key: string, depth: number): unknown {
  if (sensitiveKey.test(key)) {
    return redacted;
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return { name: value.name };
  }

  if (depth >= 4) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, key, depth + 1));
  }

  if (isLogRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeValue(nestedValue, nestedKey, depth + 1),
      ]),
    );
  }

  return String(value).slice(0, 500);
}

export function redactLogContext(
  context: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(value, key, 0)]),
  );
}
