import type { AdvertisingFixtureScenario } from "../domain/preroll-policy";
import type { AdvertisingOutcome } from "./ad-outcome";

type FakePrerollInput = Readonly<{
  container: HTMLElement;
  scenario: AdvertisingFixtureScenario;
  signal: AbortSignal;
}>;

function wait(milliseconds: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => finish(true), milliseconds);
    const handleAbort = () => finish(false);
    const finish = (completed: boolean) => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", handleAbort);
      resolve(completed);
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function renderFixture(container: HTMLElement): void {
  const surface = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("strong");
  const label = document.createElement("small");
  const progress = document.createElement("span");

  surface.className = "watch-ad-fixture";
  surface.setAttribute("role", "img");
  surface.setAttribute("aria-label", "Film Platform test reklamı");
  eyebrow.className = "watch-ad-fixture__eyebrow";
  eyebrow.textContent = "FİLM PLATFORM";
  title.textContent = "Kısa gösterim";
  label.textContent = "Test reklamı";
  progress.className = "watch-ad-fixture__progress";
  progress.setAttribute("aria-hidden", "true");
  surface.append(eyebrow, title, label, progress);
  container.replaceChildren(surface);
}

export async function playFakePreroll(
  input: FakePrerollInput,
  durationMilliseconds: number = 2_000,
): Promise<AdvertisingOutcome> {
  if (input.scenario === "blocked" || input.scenario === "empty" || input.scenario === "error") {
    return input.scenario;
  }
  if (input.scenario === "timeout" && input.signal.aborted) {
    return "timeout";
  }

  renderFixture(input.container);
  try {
    if (input.scenario === "timeout") {
      await new Promise<void>((resolve) => {
        input.signal.addEventListener("abort", () => resolve(), { once: true });
      });
      return "timeout";
    }
    return (await wait(durationMilliseconds, input.signal)) ? "completed" : "timeout";
  } finally {
    input.container.replaceChildren();
  }
}
