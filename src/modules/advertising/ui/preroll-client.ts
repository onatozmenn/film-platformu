import type { AdvertisingFixtureScenario } from "../domain/preroll-policy";
import type { AdvertisingOutcome } from "./ad-outcome";

export async function prepareGoogleImaPreroll(): Promise<"blocked" | "ready" | "timeout"> {
  try {
    const { loadGoogleImaSdk } = await import("./google-ima-sdk");
    return loadGoogleImaSdk();
  } catch {
    return "blocked";
  }
}

export async function playFixturePreroll(
  input: Readonly<{
    container: HTMLElement;
    scenario: AdvertisingFixtureScenario;
    timeoutMilliseconds?: number;
  }>,
): Promise<AdvertisingOutcome> {
  const controller = new AbortController();
  let timeout: number | undefined;
  const timeoutOutcome = new Promise<AdvertisingOutcome>((resolve) => {
    timeout = window.setTimeout(() => {
      controller.abort();
      resolve("timeout");
    }, input.timeoutMilliseconds ?? 4_000);
  });

  try {
    const adapterOutcome = import("./fake-preroll-client")
      .then(({ playFakePreroll }) =>
        playFakePreroll({
          container: input.container,
          scenario: input.scenario,
          signal: controller.signal,
        }),
      )
      .catch(() => "error" as const);
    return await Promise.race([adapterOutcome, timeoutOutcome]);
  } finally {
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
    }
    controller.abort();
    input.container.replaceChildren();
  }
}
