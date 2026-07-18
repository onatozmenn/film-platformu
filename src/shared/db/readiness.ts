export type DatabaseReadiness =
  Readonly<{ ready: true }> | Readonly<{ ready: false; reason: "query-failed" | "timeout" }>;

const timeoutMarker = Symbol("database-readiness-timeout");

export async function checkDatabaseReadiness(
  probe: () => Promise<unknown>,
  timeoutMilliseconds = 2_000,
): Promise<DatabaseReadiness> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      probe(),
      new Promise<typeof timeoutMarker>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(timeoutMarker), timeoutMilliseconds);
      }),
    ]);

    return result === timeoutMarker ? { ready: false, reason: "timeout" } : { ready: true };
  } catch {
    return { ready: false, reason: "query-failed" };
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}
