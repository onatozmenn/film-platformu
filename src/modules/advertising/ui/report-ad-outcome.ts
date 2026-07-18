import type { AdvertisingOutcome } from "./ad-outcome";

export async function reportAdvertisingOutcome(
  input: Readonly<{
    outcome: AdvertisingOutcome;
    sessionId: string;
  }>,
): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/advertising/outcomes", {
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      keepalive: true,
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}
