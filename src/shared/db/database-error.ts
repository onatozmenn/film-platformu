export function hasDatabaseErrorCode(error: unknown, ...codes: readonly string[]): boolean {
  const visited = new Set<object>();
  let current = error;

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    if ("code" in current && typeof current.code === "string" && codes.includes(current.code)) {
      return true;
    }
    if (
      "originalCode" in current &&
      typeof current.originalCode === "string" &&
      codes.includes(current.originalCode)
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }

  return false;
}
